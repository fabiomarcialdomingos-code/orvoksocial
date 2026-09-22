import nodemailer from "nodemailer";
import type { Pool } from "pg";
import { z } from "zod";
import { decryptMailPayload } from "./crypto";
import type { AuthMailPayload } from "./service";

const smtpConfig = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_FROM: z.email(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  APP_ORIGIN: z.url(),
  APP_ENV: z.enum(["development", "test", "staging", "production"]),
});

export function createAuthMailer(input: NodeJS.ProcessEnv = process.env) {
  const config = smtpConfig.parse(input);
  const local = config.SMTP_HOST === "127.0.0.1" || config.SMTP_HOST === "localhost";
  if (!local && (!config.SMTP_USER || !config.SMTP_PASS)) {
    throw new Error("SMTP authentication is required for remote mail transport");
  }
  if (config.APP_ENV === "production" && local) {
    throw new Error("Production SMTP may not use loopback");
  }
  if (config.APP_ENV === "production" && new URL(config.APP_ORIGIN).protocol !== "https:") {
    throw new Error("Production APP_ORIGIN must use HTTPS");
  }
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    requireTLS: !local && config.SMTP_PORT !== 465,
    auth: config.SMTP_USER && config.SMTP_PASS ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return async (payload: AuthMailPayload): Promise<void> => {
    const path = payload.purpose === "VERIFY_EMAIL" ? "/verificar-email" : "/nova-senha";
    const url = new URL(path, config.APP_ORIGIN);
    url.hash = `token=${encodeURIComponent(payload.token)}`;
    const subject = payload.purpose === "VERIFY_EMAIL" ? "Confirme seu e-mail ORVOK" : "Redefina sua senha ORVOK";
    await transport.sendMail({
      from: config.SMTP_FROM,
      to: payload.email,
      subject,
      text: `Acesse este link para continuar: ${url.toString()}\nSe não foi você, ignore esta mensagem.`,
    });
  };
}

export async function deliverNextAuthMail(
  pool: Pool,
  send: (payload: AuthMailPayload) => Promise<void>,
  userId: string | null = null,
): Promise<"sent" | "retry" | "idle"> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<{
      id: string; encryptedPayload: string; attempts: number;
    }>(
      `SELECT id,"encryptedPayload",attempts FROM "AuthMailOutbox"
       WHERE "deliveredAt" IS NULL AND attempts < 5 AND "nextAttemptAt"<=clock_timestamp()
         AND ($1::uuid IS NULL OR "userId"=$1)
       ORDER BY "nextAttemptAt",id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [userId],
    );
    const row = found.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return "idle";
    }
    try {
      const payload = decryptMailPayload<AuthMailPayload>(row.encryptedPayload);
      await send(payload);
      await client.query(`UPDATE "AuthMailOutbox" SET "deliveredAt"=clock_timestamp() WHERE id=$1`, [row.id]);
      await client.query("COMMIT");
      return "sent";
    } catch {
      const delaySeconds = Math.min(3600, 15 * 2 ** row.attempts);
      await client.query(
        `UPDATE "AuthMailOutbox" SET attempts=attempts+1,"failedAt"=clock_timestamp(),"nextAttemptAt"=clock_timestamp()+($2::int * interval '1 second') WHERE id=$1`,
        [row.id, delaySeconds],
      );
      await client.query("COMMIT");
      return "retry";
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

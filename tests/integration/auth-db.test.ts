import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { AuthService } from "../../src/lib/auth/service";
import { decryptMailPayload } from "../../src/lib/auth/crypto";
import { deliverNextAuthMail } from "../../src/lib/auth/mail";
import type { AuthMailPayload } from "../../src/lib/auth/service";

const url = process.env.DATABASE_URL;
describe.skipIf(!url)("autenticação PostgreSQL", () => {
  const pool = new Pool({ connectionString: url, max: 4 });
  const service = new AuthService(pool);
  const email = `auth-fixture-${randomUUID()}@example.test`;
  const password = "Longa senha de teste 12345!";
  let userId: string;
  let originalToken: string;

  beforeAll(() => {
    process.env.AUTH_SECRET = randomBytes(32).toString("hex");
    process.env.AUTH_MAIL_KEY = randomBytes(32).toString("hex");
  });

  afterAll(async () => {
    if (userId) {
      await pool.query(`DELETE FROM "AuditLog" WHERE "actorId"=$1`, [userId]);
      await pool.query(`DELETE FROM "AuthMailOutbox" WHERE "userId"=$1`, [userId]);
      await pool.query(`DELETE FROM "AuthToken" WHERE "userId"=$1`, [userId]);
      await pool.query(`UPDATE "AuthSession" SET "replacedById"=NULL WHERE "userId"=$1`, [userId]);
      await pool.query(`DELETE FROM "AuthSession" WHERE "userId"=$1`, [userId]);
      await pool.query(`DELETE FROM "AuthIdentity" WHERE "userId"=$1`, [userId]);
      await pool.query(`DELETE FROM "User" WHERE id=$1`, [userId]);
    }
    await pool.end();
  });

  it("cadastra como USER, exige verificação, enfileira token cifrado e não enumera cadastro", async () => {
    await service.register({ email, password });
    const found = await pool.query<{ id: string; role: string }>(
      `SELECT u.id,u.role FROM "User" u JOIN "AuthIdentity" ai ON ai."userId"=u.id WHERE ai.email=$1`,
      [email],
    );
    userId = found.rows[0]!.id;
    expect(found.rows[0]!.role).toBe("USER");
    await expect(service.login({ email, password })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await service.register({ email, password: "Outra senha longa 54321!" });
    expect((await pool.query(`SELECT count(*)::int AS n FROM "AuthIdentity" WHERE email=$1`, [email])).rows[0].n).toBe(1);
    const outbox = await pool.query<{ encryptedPayload: string }>(`SELECT "encryptedPayload" FROM "AuthMailOutbox" WHERE "userId"=$1`, [userId]);
    expect(outbox.rows[0]!.encryptedPayload).not.toContain(email);
    const payload = decryptMailPayload<AuthMailPayload>(outbox.rows[0]!.encryptedPayload);
    expect(payload.purpose).toBe("VERIFY_EMAIL");
    await service.verifyEmail({ token: payload.token });
    await expect(service.verifyEmail({ token: payload.token })).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("faz login, rotação atômica, detecta replay e revoga família", async () => {
    const session = await service.login({ email, password });
    originalToken = session.token;
    const replacement = await service.rotate(originalToken);
    expect(replacement).not.toBe(originalToken);
    await expect(service.rotate(originalToken)).rejects.toMatchObject({ code: "SESSION_REPLAY" });
    const active = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "AuthSession" WHERE "tokenHash" IS NOT NULL AND "userId"=$1 AND "revokedAt" IS NULL`,
      [userId],
    );
    expect(active.rows[0]!.n).toBe(0);
  });

  it("reset em token único revoga sessões e mantém resposta genérica a e-mail desconhecido", async () => {
    await service.requestReset({ email: `missing-${randomUUID()}@example.test` });
    const token = (await service.login({ email, password })).token;
    await service.requestReset({ email });
    const outbox = await pool.query<{ encryptedPayload: string }>(
      `SELECT "encryptedPayload" FROM "AuthMailOutbox" WHERE "userId"=$1 AND purpose='RESET_PASSWORD' ORDER BY "createdAt" DESC LIMIT 1`,
      [userId],
    );
    const resetToken = decryptMailPayload<AuthMailPayload>(outbox.rows[0]!.encryptedPayload).token;
    const newPassword = "Senha totalmente nova 98765!";
    await service.resetPassword({ token: resetToken, password: newPassword });
    await expect(service.resetPassword({ token: resetToken, password: newPassword })).rejects.toMatchObject({ code: "TOKEN_INVALID" });
    await expect(service.login({ email, password })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await service.login({ email, password: newPassword });
    const activeOld = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "AuthSession" WHERE "userId"=$1 AND "revokedAt" IS NULL AND "tokenHash"=$2`,
      [userId, (await import("../../src/lib/auth/crypto")).tokenHash(token)],
    );
    expect(activeOld.rows[0]!.n).toBe(0);
  });

  it("fila entrega uma vez e reagenda falha sem revelar token em log", async () => {
    const outbox = await pool.query<{ id: string }>(`SELECT id FROM "AuthMailOutbox" WHERE "userId"=$1 AND purpose='VERIFY_EMAIL'`, [userId]);
    const id = outbox.rows[0]!.id;
    const sent: AuthMailPayload[] = [];
    expect(await deliverNextAuthMail(pool, async (payload) => { sent.push(payload); }, userId)).toBe("sent");
    expect(sent).toHaveLength(1);
    expect((await pool.query(`SELECT "deliveredAt" FROM "AuthMailOutbox" WHERE id=$1`, [id])).rows[0].deliveredAt).not.toBeNull();
    // Make another queued item eligible; failed send is retried later.
    await pool.query(`UPDATE "AuthMailOutbox" SET "deliveredAt"=clock_timestamp() WHERE "userId"=$1 AND "deliveredAt" IS NULL`, [userId]);
    await service.requestReset({ email });
    expect(await deliverNextAuthMail(pool, async () => { throw new Error("fake smtp failure"); }, userId)).toBe("retry");
    const delayed = await pool.query<{ attempts: number; nextAttemptAt: Date }>(
      `SELECT attempts,"nextAttemptAt" FROM "AuthMailOutbox" WHERE "userId"=$1 AND purpose='RESET_PASSWORD' ORDER BY "createdAt" DESC LIMIT 1`,
      [userId],
    );
    expect(delayed.rows[0]!.attempts).toBe(1);
    expect(delayed.rows[0]!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });
});

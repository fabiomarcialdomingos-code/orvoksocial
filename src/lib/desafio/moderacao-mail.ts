import nodemailer from "nodemailer";
import { z } from "zod";

const smtpConfig = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_FROM: z.email(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  ORVOK_REPORT_EMAIL: z.email().optional(),
});

/**
 * Avisa por e-mail sobre uma denúncia nova. Só um aviso: a denúncia já está
 * guardada no banco antes desta função ser chamada, então uma falha aqui
 * (SMTP ausente, fora do ar, etc.) nunca derruba a resposta da API — ela
 * apenas fica para ser vista na próxima checagem manual.
 */
export async function enviarDenunciaPorEmail(denuncia: { id: string; codigo: string; criadorNome: string; motivo: string }): Promise<void> {
  try {
    const config = smtpConfig.parse(process.env);
    const destino = config.ORVOK_REPORT_EMAIL ?? "contato@orvok.com.br";
    const local = config.SMTP_HOST === "127.0.0.1" || config.SMTP_HOST === "localhost";
    const transport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      requireTLS: !local && config.SMTP_PORT !== 465,
      auth: config.SMTP_USER && config.SMTP_PASS ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
      tls: { rejectUnauthorized: true },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 15_000,
    });
    await transport.sendMail({
      from: config.SMTP_FROM,
      to: destino,
      subject: `Nova denúncia no orvok — desafio ${denuncia.codigo}`,
      text: `Denúncia ${denuncia.id}\nDesafio: ${denuncia.codigo}\nCriado por: ${denuncia.criadorNome}\n\nMotivo:\n${denuncia.motivo}`,
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "denuncia_mail_failure", errorName: (error as Error)?.name }));
  }
}

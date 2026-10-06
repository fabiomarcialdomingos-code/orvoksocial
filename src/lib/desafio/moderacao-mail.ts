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
async function enviarParaModeracao(assunto: string, texto: string): Promise<void> {
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
    await transport.sendMail({ from: config.SMTP_FROM, to: destino, subject: assunto, text: texto });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "denuncia_mail_failure", errorName: (error as Error)?.name }));
  }
}

export async function enviarDenunciaPorEmail(denuncia: { id: string; codigo: string; criadorNome: string; motivo: string }): Promise<void> {
  await enviarParaModeracao(
    `Nova denúncia no orvok — convite ${denuncia.codigo}`,
    `Denúncia ${denuncia.id}\nConvite: ${denuncia.codigo}\nCriado por: ${denuncia.criadorNome}\n\nMotivo:\n${denuncia.motivo}`,
  );
}

/** Denúncia de uma conversa privada. O texto das mensagens NÃO vai no e-mail: quem modera abre no banco, só por causa da denúncia. */
export async function enviarDenunciaDeConversaPorEmail(denuncia: { id: string; codigoRodada: string; threadId: string; lado: string; motivo: string }): Promise<void> {
  await enviarParaModeracao(
    `Denúncia de conversa privada no orvok — rodada ${denuncia.codigoRodada}`,
    `Denúncia ${denuncia.id}\nConversa: ${denuncia.threadId}\nRodada: ${denuncia.codigoRodada}\nDenunciou: ${denuncia.lado}\n\nMotivo:\n${denuncia.motivo}\n\nAs mensagens só devem ser lidas por causa desta denúncia.`,
  );
}

/** Denúncia de uma lembrança da Estante. O e-mail leva só identificadores: o conteúdo (texto e foto) é aberto no banco, por causa da denúncia. */
export async function enviarDenunciaDaEstantePorEmail(denuncia: { id: string; lembranca: string; motivo: string }): Promise<void> {
  await enviarParaModeracao(
    "Denúncia de lembrança da Estante no orvok",
    `Denúncia ${denuncia.id}\nLembrança: ${denuncia.lembranca}\n\nMotivo:\n${denuncia.motivo}\n\nO conteúdo só deve ser aberto por causa desta denúncia. Para remover: workflow "Estante: remover lembrança" com o id da lembrança.`,
  );
}

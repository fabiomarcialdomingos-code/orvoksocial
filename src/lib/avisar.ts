import type { Pool } from "pg";
import { enviarPush } from "@/lib/push";

/**
 * Notifica quem tem conta e, se a pessoa ativou, manda um aviso push com o selo atualizado.
 * O texto nunca leva o conteúdo privado (frases, mensagens): só o fato de que há algo novo.
 */
export async function avisar(
  pool: Pool, recipientId: string, eventType: string, sourceId: string,
  aviso: { titulo: string; corpo: string; url: string }, opcoes: { push?: boolean } = {},
): Promise<void> {
  await pool.query(`SELECT orvok_social_notify($1,$2,$3::uuid)`, [recipientId, eventType, sourceId]).catch(() => undefined);
  if (opcoes.push === false) return;
  const n = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM "Notification" WHERE "recipientId"=$1 AND state='UNREAD'`, [recipientId]).catch(() => null);
  await enviarPush(pool, recipientId, { ...aviso, selo: n ? Number(n.rows[0]!.n) : undefined }).catch(() => undefined);
}

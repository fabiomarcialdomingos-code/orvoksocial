import type { Pool } from "pg";
import webpush from "web-push";

/** Se as chaves VAPID não estiverem configuradas, o push fica desligado sem quebrar nada. */
export function pushDisponivel(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configurar(): boolean {
  if (!pushDisponivel()) return false;
  webpush.setVapidDetails(process.env.VAPID_CONTACT_EMAIL || "mailto:contato@orvok.com.br", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return true;
}

export type Aviso = { titulo: string; corpo: string; url: string; selo?: number | undefined };

/**
 * Manda um aviso para todos os aparelhos de uma pessoa. Nunca derruba quem
 * chamou: falhas de envio só são registradas, e inscrições mortas (aparelho
 * desinstalou, permissão revogada) são apagadas na hora.
 */
export async function enviarPush(pool: Pool, userId: string, aviso: Aviso): Promise<void> {
  if (!configurar()) return;
  const r = await pool.query<{ endpoint: string; p256dh: string; auth: string }>(
    `SELECT endpoint, p256dh, auth FROM "PushSubscription" WHERE "userId"=$1`, [userId]);
  const payload = JSON.stringify(aviso);
  await Promise.all(r.rows.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await pool.query(`DELETE FROM "PushSubscription" WHERE endpoint=$1`, [s.endpoint]).catch(() => undefined);
      else console.error(JSON.stringify({ level: "error", event: "push_send_failure", status }));
    }
  }));
}

import { leituraPublica } from "@/lib/desafio/http";
import { pushDisponivel } from "@/lib/push";

export const runtime = "nodejs";
/** A chave pública VAPID, segura para expor; sem ela o app não tenta se inscrever. */
export async function GET() {
  return leituraPublica(async () => Response.json({ schemaVersion: "1", disponivel: pushDisponivel(), chave: process.env.VAPID_PUBLIC_KEY ?? null }));
}

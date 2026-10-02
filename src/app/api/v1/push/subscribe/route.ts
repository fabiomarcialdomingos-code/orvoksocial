import { z } from "zod";
import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { principalOpcional } from "@/lib/desafio/http";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
const schema = z.strictObject({ endpoint: z.url().max(2000), expirationTime: z.number().nullable().optional(), keys: z.strictObject({ p256dh: z.string().min(1).max(255), auth: z.string().min(1).max(255) }) });
/** Guarda a inscrição deste aparelho para receber avisos. Exige login e o aceite explícito do navegador. */
export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    const userId = await principalOpcional(request);
    if (!userId) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    const d = schema.parse(body);
    await authPool().query(
      `INSERT INTO "PushSubscription" (id,"userId",endpoint,p256dh,auth) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET "userId"=EXCLUDED."userId",p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth`,
      [randomUUID(), userId, d.endpoint, d.keys.p256dh, d.keys.auth]);
    return Response.json({ schemaVersion: "1", ok: true });
  });
}

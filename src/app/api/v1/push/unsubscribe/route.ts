import { z } from "zod";
import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { principalOpcional } from "@/lib/desafio/http";

export const runtime = "nodejs";
const schema = z.strictObject({ endpoint: z.url().max(2000) });
/** Remove a inscrição deste aparelho (desligar avisos, ou o navegador cancelou sozinho). */
export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    const userId = await principalOpcional(request);
    if (!userId) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    const { endpoint } = schema.parse(body);
    await authPool().query(`DELETE FROM "PushSubscription" WHERE endpoint=$1 AND "userId"=$2`, [endpoint, userId]);
    return Response.json({ schemaVersion: "1", ok: true });
  });
}

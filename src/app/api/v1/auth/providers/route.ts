import { authPool, requirePrincipal } from "@/lib/auth/session";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const principal = await requirePrincipal(request);
    const result = await authPool().query<{ hasPassword: boolean; googleLinked: boolean }>(`SELECT (ai."passwordHash" IS NOT NULL) AS "hasPassword",EXISTS (SELECT 1 FROM "AuthProviderIdentity" pi WHERE pi."userId"=ai."userId" AND pi.provider='google') AS "googleLinked" FROM "AuthIdentity" ai WHERE ai."userId"=$1`, [principal.userId]);
    return Response.json({ schemaVersion: "1", ...result.rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ schemaVersion: "1", code: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}

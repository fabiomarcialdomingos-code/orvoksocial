import { AuthService } from "@/lib/auth/service";
import { authPool, requirePrincipal } from "@/lib/auth/session";
import { assertMutationRequest } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/session";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertMutationRequest(request);
    const principal = await requirePrincipal(request);
    await new AuthService(authPool()).unlinkGoogle(principal.userId);
    return Response.json({ schemaVersion: "1", unlinked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const code = error instanceof AuthError ? error.code : "INTERNAL_ERROR";
    return Response.json({ schemaVersion: "1", code, message: code === "AUTH_METHOD_REQUIRED" ? "Mantenha outro método de acesso antes de desvincular o Google." : code }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

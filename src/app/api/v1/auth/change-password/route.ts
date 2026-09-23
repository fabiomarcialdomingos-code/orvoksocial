import { authEndpoint } from "@/lib/auth/http";
import { AuthService } from "@/lib/auth/service";
import { authPool, requirePrincipal } from "@/lib/auth/session";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    const principal = await requirePrincipal(request);
    await new AuthService(authPool()).changePassword(principal.userId, body);
    return Response.json({ schemaVersion: "1", changed: true }, { headers: { "Cache-Control": "no-store" } });
  });
}

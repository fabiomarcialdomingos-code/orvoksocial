import { authEndpoint } from "@/lib/auth/http";
import { AuthError, authPool, requirePrincipal } from "@/lib/auth/session";
import { DesafioService, lerTokenConvidado } from "@/lib/desafio/service";

export const runtime = "nodejs";
/** Depois do cadastro, liga à conta os desafios e tentativas deste aparelho. */
export async function POST(request: Request) {
  return authEndpoint(request, async () => {
    const { userId } = await requirePrincipal(request);
    const token = lerTokenConvidado(request);
    if (!token) throw new AuthError("NOTHING_TO_CLAIM", 404);
    const vinculados = await new DesafioService(authPool()).reivindicar(token, userId);
    return Response.json({ schemaVersion: "1", vinculados });
  });
}

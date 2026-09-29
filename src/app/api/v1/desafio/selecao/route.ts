import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { DesafioService } from "@/lib/desafio/service";

export const runtime = "nodejs";
/** Recebe as respostas das âncoras e devolve as outras sete perguntas. */
export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    const perguntas = await new DesafioService(authPool()).restantes(body);
    return Response.json({ schemaVersion: "1", perguntas });
  });
}

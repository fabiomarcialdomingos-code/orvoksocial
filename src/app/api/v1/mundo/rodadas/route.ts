import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { leituraPublica, principalOpcional } from "@/lib/desafio/http";
import { lerTokenConvidado } from "@/lib/desafio/service";
import { MundoService } from "@/lib/mundo/service";

export const runtime = "nodejs";
/** Rodadas de quem está logado (criadas e recebidas). */
export async function GET(request: Request) {
  return leituraPublica(async () => {
    const userId = await principalOpcional(request);
    if (!userId) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    return Response.json({ schemaVersion: "1", rodadas: await new MundoService(authPool()).minhas(userId, lerTokenConvidado(request)) });
  });
}
/** Cria uma rodada: "quero ser previsto" (com a resposta secreta) ou "quero prever alguém". */
export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    const userId = await principalOpcional(request);
    if (!userId) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    return Response.json({ schemaVersion: "1", ...(await new MundoService(authPool()).criar(body, userId)) }, { status: 201 });
  });
}

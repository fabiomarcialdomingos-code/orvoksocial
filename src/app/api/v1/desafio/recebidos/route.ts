import { authPool } from "@/lib/auth/session";
import { leituraPublica, principalOpcional } from "@/lib/desafio/http";
import { DesafioService, lerTokenConvidado } from "@/lib/desafio/service";

export const runtime = "nodejs";
/** Desafios que a pessoa tentou prever, com o próprio placar. */
export async function GET(request: Request) {
  return leituraPublica(async () => {
    const userId = await principalOpcional(request);
    const itens = await new DesafioService(authPool()).recebidos(lerTokenConvidado(request), userId);
    return Response.json({ schemaVersion: "1", itens });
  });
}

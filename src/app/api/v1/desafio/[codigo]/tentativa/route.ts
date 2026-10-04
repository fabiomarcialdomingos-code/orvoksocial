import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { principalOpcional } from "@/lib/desafio/http";
import { DesafioService, gravarTokenConvidado, lerTokenConvidado } from "@/lib/desafio/service";

export const runtime = "nodejs";
/** Registra a visão de quem recebeu o convite. Não existe pontuação: devolve só o quanto ela se parece com a das outras pessoas. */
export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return authEndpoint(request, async (body) => {
    const atual = lerTokenConvidado(request);
    const { token, miniResultado } = await new DesafioService(authPool()).tentar(codigo, body, atual, await principalOpcional(request));
    const response = Response.json({ schemaVersion: "1", miniResultado });
    if (token !== atual) gravarTokenConvidado(response, token);
    return response;
  });
}

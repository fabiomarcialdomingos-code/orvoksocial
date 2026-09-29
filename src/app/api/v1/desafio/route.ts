import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { DesafioService, gravarTokenConvidado, lerTokenConvidado } from "@/lib/desafio/service";

export const runtime = "nodejs";
/** Cria um desafio sem cadastro. */
export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    const atual = lerTokenConvidado(request);
    const { codigo, token } = await new DesafioService(authPool()).criar(body, atual);
    const response = Response.json({ schemaVersion: "1", codigo, caminho: `/d/${codigo}` }, { status: 201 });
    if (token !== atual) gravarTokenConvidado(response, token);
    return response;
  });
}

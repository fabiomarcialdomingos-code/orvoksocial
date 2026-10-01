import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { leituraPublica, principalOpcional } from "@/lib/desafio/http";
import { gravarTokenConvidado, lerTokenConvidado } from "@/lib/desafio/service";
import { MundoService } from "@/lib/mundo/service";

export const runtime = "nodejs";
/** O que o convidado pode ver agora (sem conta). */
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  return leituraPublica(async () => {
    const { codigo } = await params;
    return Response.json({ schemaVersion: "1", rodada: await new MundoService(authPool()).verComoConvidado(codigo.toUpperCase(), lerTokenConvidado(request)) });
  });
}
/** O convidado responde ou adivinha. */
export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return authEndpoint(request, async (body) => {
    const atual = lerTokenConvidado(request);
    const { token, ...rodada } = await new MundoService(authPool()).participar(codigo.toUpperCase(), body, atual, await principalOpcional(request));
    const response = Response.json({ schemaVersion: "1", rodada });
    if (token !== atual) gravarTokenConvidado(response, token);
    return response;
  });
}

import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { leituraPublica, principalOpcional } from "@/lib/desafio/http";
import { gravarTokenConvidado, lerTokenConvidado } from "@/lib/desafio/service";
import { MundoService } from "@/lib/mundo/service";

export const runtime = "nodejs";
/** A conversa desta rodada (só para as duas pessoas que participaram dela). */
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  return leituraPublica(async () => {
    const { codigo } = await params;
    return Response.json({ schemaVersion: "1", conversa: await new MundoService(authPool()).conversa(codigo.toUpperCase(), lerTokenConvidado(request), await principalOpcional(request)) });
  });
}
/** Propor, aceitar, recusar, encerrar, enviar mensagem ou denunciar. */
export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return authEndpoint(request, async (body) => {
    const atual = lerTokenConvidado(request);
    const r = await new MundoService(authPool()).agirNaConversa(codigo.toUpperCase(), body, atual, await principalOpcional(request));
    const response = Response.json({ schemaVersion: "1", ...r });
    if (atual) gravarTokenConvidado(response, atual);
    return response;
  });
}

import { after } from "next/server";
import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { cartaoDoConvite } from "@/lib/desafio/cartao-armazem";
import { principalOpcional } from "@/lib/desafio/http";
import { DesafioService, gravarTokenConvidado, lerTokenConvidado } from "@/lib/desafio/service";

export const runtime = "nodejs";
/** Cria um desafio sem cadastro. */
export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    const atual = lerTokenConvidado(request);
    const { codigo, token } = await new DesafioService(authPool()).criar(body, atual, await principalOpcional(request));
    // O card é desenhado logo depois de criar o convite, antes de a pessoa terminar de compartilhar.
    after(async () => { await cartaoDoConvite(authPool(), codigo, async (...a) => (await import("@/lib/desafio/cartao-gerar")).gerarCartao(...a)).catch(() => undefined); });
    const response = Response.json({ schemaVersion: "1", codigo, caminho: `/d/${codigo}` }, { status: 201 });
    if (token !== atual) gravarTokenConvidado(response, token);
    return response;
  });
}

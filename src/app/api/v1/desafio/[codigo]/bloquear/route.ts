import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { principalOpcional } from "@/lib/desafio/http";
import { DesafioService, gravarTokenConvidado, lerTokenConvidado } from "@/lib/desafio/service";

export const runtime = "nodejs";
/** Bloqueia quem enviou este convite: não consegue mais te mandar novos. */
export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return authEndpoint(request, async () => {
    const atual = lerTokenConvidado(request);
    const { token } = await new DesafioService(authPool()).bloquear(codigo, atual, await principalOpcional(request));
    const response = Response.json({ schemaVersion: "1", bloqueado: true });
    if (token !== atual) gravarTokenConvidado(response, token);
    return response;
  });
}

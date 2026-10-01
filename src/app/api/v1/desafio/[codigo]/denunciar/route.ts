import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { principalOpcional } from "@/lib/desafio/http";
import { DesafioService, gravarTokenConvidado, lerTokenConvidado } from "@/lib/desafio/service";
import { enviarDenunciaPorEmail } from "@/lib/desafio/moderacao-mail";

export const runtime = "nodejs";
/** Denuncia o convite. Fica guardado no banco e, se possível, avisa por e-mail. */
export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return authEndpoint(request, async (body) => {
    const atual = lerTokenConvidado(request);
    const { id, nome, motivo, token } = await new DesafioService(authPool()).denunciar(codigo, body, atual, await principalOpcional(request));
    await enviarDenunciaPorEmail({ id, codigo, criadorNome: nome, motivo });
    const response = Response.json({ schemaVersion: "1", denunciado: true });
    if (token !== atual) gravarTokenConvidado(response, token);
    return response;
  });
}

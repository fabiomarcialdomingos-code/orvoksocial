import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { principalOpcional } from "@/lib/desafio/http";
import { DesafioService, lerTokenConvidado } from "@/lib/desafio/service";

export const runtime = "nodejs";
/** Cancela o convite, como promete o aviso de consentimento. */
export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return authEndpoint(request, async () => {
    const userId = await principalOpcional(request);
    await new DesafioService(authPool()).cancelar(codigo, lerTokenConvidado(request), userId);
    return Response.json({ schemaVersion: "1", cancelado: true });
  });
}

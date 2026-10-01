import { authPool } from "@/lib/auth/session";
import { leituraPublica, principalOpcional } from "@/lib/desafio/http";
import { DesafioService, lerTokenConvidado } from "@/lib/desafio/service";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  return leituraPublica(async () => {
    const { codigo } = await params;
    const dados = await new DesafioService(authPool()).vitrine(codigo, lerTokenConvidado(request), await principalOpcional(request));
    return Response.json({ schemaVersion: "1", ...dados });
  });
}

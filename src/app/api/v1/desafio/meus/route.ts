import { authPool } from "@/lib/auth/session";
import { leituraPublica, principalOpcional } from "@/lib/desafio/http";
import { DesafioService, lerTokenConvidado } from "@/lib/desafio/service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return leituraPublica(async () => {
    const userId = await principalOpcional(request);
    const dados = await new DesafioService(authPool()).meus(lerTokenConvidado(request), userId);
    return Response.json({ schemaVersion: "1", ...dados });
  });
}

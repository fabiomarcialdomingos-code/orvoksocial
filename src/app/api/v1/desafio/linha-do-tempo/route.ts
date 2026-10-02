import { authPool } from "@/lib/auth/session";
import { leituraPublica, principalOpcional } from "@/lib/desafio/http";
import { DesafioService, lerTokenConvidado } from "@/lib/desafio/service";

export const runtime = "nodejs";
/** Os marcos em que o selo do retrato mudou, do mais antigo ao mais novo. */
export async function GET(request: Request) {
  return leituraPublica(async () => {
    const marcos = await new DesafioService(authPool()).linhaDoTempo(lerTokenConvidado(request), await principalOpcional(request));
    return Response.json({ schemaVersion: "1", marcos });
  });
}

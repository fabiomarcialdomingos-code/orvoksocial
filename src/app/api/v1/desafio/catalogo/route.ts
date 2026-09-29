import { authPool } from "@/lib/auth/session";
import { AVISO } from "@/lib/desafio/catalogo";
import { leituraPublica } from "@/lib/desafio/http";
import { DesafioService } from "@/lib/desafio/service";

export const runtime = "nodejs";
/**
 * Abertura do questionário. Sem parâmetros: três âncoras escolhidas na hora.
 * Com `?de=CODIGO`: as mesmas 10 perguntas de um desafio existente ("desafie de volta").
 */
export async function GET(request: Request) {
  return leituraPublica(async () => {
    const de = new URL(request.url).searchParams.get("de");
    const servico = new DesafioService(authPool());
    if (de) return Response.json({ schemaVersion: "1", ...(await servico.conjuntoDe(de.toUpperCase())), aviso: AVISO });
    return Response.json({ schemaVersion: "1", ancoras: servico.ancoras(), aviso: AVISO });
  });
}

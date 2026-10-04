import { authPool } from "@/lib/auth/session";
import { AVISO } from "@/lib/desafio/catalogo";
import { leituraPublica } from "@/lib/desafio/http";
import { DesafioService } from "@/lib/desafio/service";

export const runtime = "nodejs";
/**
 * Abertura do questionário: as 12 perguntas, escolhidas na hora para a relação.
 * Com `?de=CODIGO`: as mesmas perguntas de um convite existente ("convide de volta").
 */
export async function GET(request: Request) {
  return leituraPublica(async () => {
    const de = new URL(request.url).searchParams.get("de");
    const servico = new DesafioService(authPool());
    if (de) return Response.json({ schemaVersion: "1", ...(await servico.conjuntoDe(de.toUpperCase())), aviso: AVISO });
    const rel = new URL(request.url).searchParams.get("rel");
    const relacao = rel === "familia" || rel === "crush" ? rel : "amigos";
    return Response.json({ schemaVersion: "1", perguntas: await servico.conjunto(relacao), aviso: AVISO });
  });
}

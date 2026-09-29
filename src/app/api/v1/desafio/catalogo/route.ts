import { AVISO_HASH, AVISO_TEXTO, AVISO_VERSAO, perguntasPublicas } from "@/lib/desafio/catalogo";
import { leituraPublica } from "@/lib/desafio/http";

export const runtime = "nodejs";
export async function GET() {
  return leituraPublica(async () =>
    Response.json({ schemaVersion: "1", perguntas: perguntasPublicas(), aviso: { versao: AVISO_VERSAO, hash: AVISO_HASH, texto: AVISO_TEXTO } }));
}

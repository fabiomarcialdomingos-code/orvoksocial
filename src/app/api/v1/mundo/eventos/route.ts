import { authPool } from "@/lib/auth/session";
import { leituraPublica, principalOpcional } from "@/lib/desafio/http";
import { MundoService } from "@/lib/mundo/service";

export const runtime = "nodejs";
/** Eventos abertos da semana, para escolher o assunto de uma rodada. */
export async function GET(request: Request) {
  return leituraPublica(async () => {
    if (!(await principalOpcional(request))) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    return Response.json({ schemaVersion: "1", eventos: await new MundoService(authPool()).eventosAbertos() });
  });
}

import { authPool } from "@/lib/auth/session";
import { leituraPublica, principalOpcional } from "@/lib/desafio/http";
import { lerTokenConvidado } from "@/lib/desafio/service";
import { MundoService } from "@/lib/mundo/service";

export const runtime = "nodejs";
/** Meu placar: as rodadas reveladas, pessoa por pessoa, nas duas direções. */
export async function GET(request: Request) {
  return leituraPublica(async () => {
    const userId = await principalOpcional(request);
    if (!userId) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    return Response.json({ schemaVersion: "1", ...(await new MundoService(authPool()).placar(userId, lerTokenConvidado(request))) });
  });
}

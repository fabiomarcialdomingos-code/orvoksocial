import { authPool } from "@/lib/auth/session";
import { leituraPublica, principalOpcional } from "@/lib/desafio/http";
import { lerTokenConvidado } from "@/lib/desafio/service";
import { MundoService } from "@/lib/mundo/service";

export const runtime = "nodejs";
/** Minhas conexões: em que assuntos a conta e cada pessoa pensaram igual ou diferente. */
export async function GET(request: Request) {
  return leituraPublica(async () => {
    const userId = await principalOpcional(request);
    if (!userId) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    return Response.json({ schemaVersion: "1", ...(await new MundoService(authPool()).conexoes(userId, lerTokenConvidado(request))) });
  });
}

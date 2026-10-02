import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { principalOpcional } from "@/lib/desafio/http";
import { DesafioService, lerTokenConvidado } from "@/lib/desafio/service";

export const runtime = "nodejs";
/** Marca ou desmarca um traço como "eu sei, mas não mostro". Só a própria pessoa vê isso. */
export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    const r = await new DesafioService(authPool()).marcarOculto(body, lerTokenConvidado(request), await principalOpcional(request));
    return Response.json({ schemaVersion: "1", ...r });
  });
}

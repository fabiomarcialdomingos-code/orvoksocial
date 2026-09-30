import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { DesafioService } from "@/lib/desafio/service";

export const runtime = "nodejs";
/** Diagnóstico "como você se vê" a partir das respostas. Não grava nada. */
export async function POST(request: Request) {
  return authEndpoint(request, async (body) => Response.json({ schemaVersion: "1", perfil: new DesafioService(authPool()).diagnostico(body) }));
}

import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { principalOpcional } from "@/lib/desafio/http";
import { MundoService } from "@/lib/mundo/service";

export const runtime = "nodejs";
/** Quem criou a conversa dá a sua opinião, depois do convidado. */
export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return authEndpoint(request, async (body) => {
    const userId = await principalOpcional(request);
    if (!userId) return Response.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    return Response.json({ schemaVersion: "1", rodada: await new MundoService(authPool()).opinar(codigo, body, userId) });
  });
}

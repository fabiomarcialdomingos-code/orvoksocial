import { z } from "zod";
import { tokenHash } from "@/lib/auth/crypto";
import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";
import { lerTokenConvidado } from "@/lib/desafio/service";
import { registrarEvento } from "@/lib/medicao";

export const runtime = "nodejs";
/** Passos que só o navegador conhece (compartilhar, enviar convite). */
export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    const d = z.strictObject({ passo: z.enum(["cartao_compartilhado", "convite_enviado", "mundo_revelacao_vista"]), codigo: z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/).optional() }).parse(body);
    const t = lerTokenConvidado(request);
    await registrarEvento(authPool(), d.passo, d.codigo ?? null, t ? tokenHash(t) : null);
    return Response.json({ ok: true });
  });
}

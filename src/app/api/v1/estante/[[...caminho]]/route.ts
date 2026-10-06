import { z } from "zod";
import { authEndpoint } from "@/lib/auth/http";
import { randomToken } from "@/lib/auth/crypto";
import { AuthError, assertUploadRequest, authPool } from "@/lib/auth/session";
import { leituraPublica, principalOpcional } from "@/lib/desafio/http";
import { gravarTokenConvidado, lerTokenConvidado } from "@/lib/desafio/service";
import { criarEstante } from "@/lib/estante/instancia";
import type { Ator } from "@/lib/estante/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const LIMITE_FOTO = 4_000_000;

/** Quem está falando: a conta e/ou este aparelho. Quem chega sem nenhum dos dois ganha um aparelho novo. */
async function identificar(request: Request): Promise<{ ator: Ator; novoToken: string | null }> {
  const userId = await principalOpcional(request);
  const token = lerTokenConvidado(request);
  if (!userId && !token) { const novo = randomToken(); return { ator: { token: novo, userId: null }, novoToken: novo }; }
  return { ator: { token, userId }, novoToken: null };
}
const json = (corpo: unknown, novoToken: string | null = null, status = 200): Response => {
  const r = Response.json({ schemaVersion: "1", ...(corpo as object) }, { status });
  if (novoToken) gravarTokenConvidado(r, novoToken);
  return r;
};
const naoExiste = () => Response.json({ schemaVersion: "1", code: "NOT_FOUND", message: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } });

type Contexto = { params: Promise<{ caminho?: string[] }> };

export async function GET(request: Request, { params }: Contexto) {
  const { caminho = [] } = await params;
  return leituraPublica(async () => {
    const svc = criarEstante(authPool());
    if (caminho[0] === "estado") return json({ ativa: await svc.ativa(), fotos: svc.fotosDisponiveis() });
    if (!(await svc.ativa())) return naoExiste();
    const { ator } = await identificar(request);
    const [a, b] = caminho;
    if (a === "eu" && caminho.length === 1) {
      const [estante, circulo, enviadas, albuns] = await Promise.all([svc.minhaEstante(ator), svc.circulo(ator), svc.enviadas(ator), svc.albuns(ator)]);
      return json({ pessoa: estante?.pessoa ?? null, estante, circulo, enviadas, albuns, fotos: svc.fotosDisponiveis() });
    }
    if (a === "presente" && b) return json({ presente: await svc.verPresente(b) });
    if (a === "convite" && b) return json({ convite: await svc.previaConvite(b) });
    if (a === "pessoas" && b) return json({ estante: await svc.estanteDe(ator, b) });
    if (a === "album" && caminho.length === 1) {
      const q = new URL(request.url).searchParams;
      const filtro = { tipo: q.get("tipo"), ...(q.get("pessoaId") ? { pessoaId: q.get("pessoaId") } : {}), ...(q.get("ano") ? { ano: Number(q.get("ano")) } : {}) };
      return json({ itens: await svc.album(ator, filtro) });
    }
    if (a === "imagens" && b) {
      const img = await svc.imagem(ator, b);
      const baixar = new URL(request.url).searchParams.get("baixar") === "1";
      return new Response(new Uint8Array(img.bytes), { headers: {
        "Content-Type": img.mime, "Content-Length": String(img.bytes.length), "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": baixar ? `attachment; filename="${img.nome}"` : "inline",
      } });
    }
    throw new AuthError("NOT_FOUND", 404);
  });
}

export async function POST(request: Request, { params }: Contexto) {
  const { caminho = [] } = await params;
  const [a, b, c] = caminho;

  // Envio de foto: o corpo é a imagem, não JSON.
  if (a === "imagens" && caminho.length === 1) {
    return leituraPublica(async () => {
      assertUploadRequest(request);
      const svc = criarEstante(authPool());
      if (!(await svc.ativa())) return naoExiste();
      const finalidade = z.enum(["avatar", "keepsake"]).parse(new URL(request.url).searchParams.get("finalidade"));
      if (Number(request.headers.get("content-length") ?? 0) > LIMITE_FOTO) throw new AuthError("PAYLOAD_TOO_LARGE", 413);
      const corpo = Buffer.from(await request.arrayBuffer());
      if (corpo.length > LIMITE_FOTO) throw new AuthError("PAYLOAD_TOO_LARGE", 413);
      const { ator, novoToken } = await identificar(request);
      return json(await svc.subirImagem(ator, corpo, finalidade), novoToken, 201);
    });
  }

  return authEndpoint(request, async (corpo) => {
    const svc = criarEstante(authPool());
    if (!(await svc.ativa())) return naoExiste();
    const { ator, novoToken } = await identificar(request);
    const dados = (corpo ?? {}) as Record<string, unknown>;
    if (a === "pessoa" && caminho.length === 1) return json({ pessoa: await svc.garantir(ator, dados) }, novoToken);
    if (a === "lembrancas" && caminho.length === 1) return json(await svc.enviar(ator, dados), novoToken, 201);
    if (a === "lembrancas" && b && c) {
      if (c === "reagir") return json(await svc.reagir(ator, b, dados.nota));
      if (c === "ilustrar") return json(await svc.ilustrar(ator, b));
      if (c === "ocultar") { await svc.ocultar(ator, b); return json({ ok: true }); }
      if (c === "recolher") { await svc.recolher(ator, b); return json({ ok: true }); }
      if (c === "denunciar") { await svc.denunciar(ator, b, dados.motivo); return json({ ok: true }); }
    }
    if (a === "presente" && b) return json({ presente: await svc.abrirPresente(b, ator, dados) }, novoToken);
    if (a === "convite" && b) return json(await svc.entrarPeloConvite(b, ator, dados), novoToken);
    if (a === "pessoas" && b && c === "marcar") { await svc.marcar(ator, b); return json({ ok: true }); }
    if (a === "pessoas" && b && c === "bloquear") { await svc.bloquear(ator, b); return json({ ok: true }); }
    if (a === "avatar" && caminho.length === 1) {
      const id = z.uuid().nullable().parse(dados.imageId ?? null);
      if (id) await svc.definirAvatar(ator, id); else await svc.removerAvatar(ator);
      return json({ ok: true });
    }
    throw new AuthError("NOT_FOUND", 404);
  });
}

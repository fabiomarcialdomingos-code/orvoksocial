import { authPool } from "@/lib/auth/session";
import { cartaoDoConvite } from "@/lib/desafio/cartao-armazem";
import { DesafioService } from "@/lib/desafio/service";

export const runtime = "nodejs";

/** O gerador (que traz o desenhista de imagens) só é carregado quando precisa desenhar; a leitura do card pronto é leve. */
const gerar = async (...a: Parameters<typeof import("@/lib/desafio/cartao-gerar").gerarCartao>) => (await import("@/lib/desafio/cartao-gerar")).gerarCartao(...a);
const genericos = new Map<string, Buffer>();

const imagem = (png: Buffer, cache: string) => new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Content-Length": String(png.length), "Cache-Control": cache, "X-Content-Type-Options": "nosniff" } });

/**
 * O card do convite. Sem parâmetro (ou com ?v= igual à versão atual): a prévia 1200×630 que o WhatsApp mostra, entregue pronta do
 * banco e guardada em cache por um ano (a versão muda junto com o nome ou o desenho). Com ?formato=stories: o cartão vertical
 * 1080×1920, desenhado na hora (é uma ação da pessoa, não de um robô).
 */
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const url = new URL(request.url);
  const formato = url.searchParams.get("formato") === "stories" ? "stories" : "preview";
  const pool = authPool();
  const codigoMaiusculo = codigo.toUpperCase();

  if (formato === "stories") {
    const r = await new DesafioService(pool).resumoPublico(codigoMaiusculo).catch(() => null);
    return imagem(await gerar(r?.nome ?? null, r?.relacao ?? null, "stories"), "public, max-age=3600");
  }
  const pronto = await cartaoDoConvite(pool, codigoMaiusculo, gerar).catch(() => null);
  if (pronto) {
    const atual = url.searchParams.get("v") === pronto.versao;
    return imagem(pronto.png, atual ? "public, max-age=31536000, immutable" : "public, max-age=300");
  }
  // Convite inexistente ou expirado: o card genérico, desenhado uma vez por servidor.
  if (!genericos.has("preview")) genericos.set("preview", await gerar(null, null, "preview"));
  return imagem(genericos.get("preview")!, "public, max-age=3600");
}


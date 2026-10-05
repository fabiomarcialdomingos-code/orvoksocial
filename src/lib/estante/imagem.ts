import { createHash } from "node:crypto";
import sharp from "sharp";
import { AuthError } from "@/lib/auth/session";

/** O que cada tipo de foto vira: a fotinha é quadrada e pequena; a foto da lembrança cabe em 1280 px. */
export const FINALIDADES = {
  avatar: { lado: 512, quadrada: true },
  keepsake: { lado: 1280, quadrada: false },
} as const;
export type Finalidade = keyof typeof FINALIDADES;

const FORMATOS = new Set(["jpeg", "png", "webp", "gif"]);
export const TAMANHO_MAXIMO_ENTRADA = 6_000_000;

export type ImagemProcessada = { bytes: Buffer; mime: "image/webp"; largura: number; altura: number; sha256: string };

/**
 * Reduz e reencoda toda foto recebida para webp. Isso (1) tira os metadados, inclusive a localização
 * de onde a foto foi tirada, (2) acaba com qualquer coisa embutida que não seja imagem e (3) limita
 * o tamanho guardado. Imagens animadas viram só o primeiro quadro.
 */
export async function processarImagem(entrada: Buffer, finalidade: Finalidade): Promise<ImagemProcessada> {
  if (entrada.length === 0) throw new AuthError("INVALID_INPUT", 400);
  if (entrada.length > TAMANHO_MAXIMO_ENTRADA) throw new AuthError("PAYLOAD_TOO_LARGE", 413);
  const cfg = FINALIDADES[finalidade];
  try {
    const base = sharp(entrada, { limitInputPixels: 40_000_000, failOn: "error", animated: false });
    const meta = await base.metadata();
    if (!meta.format || !FORMATOS.has(meta.format)) throw new AuthError("INVALID_INPUT", 400);
    const { data, info } = await base
      .rotate()
      .resize({ width: cfg.lado, height: cfg.lado, fit: cfg.quadrada ? "cover" : "inside", withoutEnlargement: !cfg.quadrada })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, mime: "image/webp", largura: info.width, altura: info.height, sha256: createHash("sha256").update(data).digest("hex") };
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError("INVALID_INPUT", 400);
  }
}

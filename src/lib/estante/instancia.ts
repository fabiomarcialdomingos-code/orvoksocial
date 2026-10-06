import type { Pool } from "pg";
import type { Ilustrador } from "./ilustrador";
import { EXEMPLOS } from "./ilustrador";
import type { Moderador } from "./moderacao";
import { EstanteService } from "./service";
import { sanitizarSvg } from "./svg";

/**
 * Cria o serviço da Estante. Em desenvolvimento, com ORVOK_ESTANTE_SIMULADA=1, usa um moderador e um
 * ilustrador de mentira (sem chave, sem custo) para dar para ver e testar as telas. Isso NUNCA vale em
 * produção: precisa das duas condições juntas.
 */
const EXTRA = [
  `<svg viewBox="0 0 120 120"><path d="M50 102l6-50h12l6 50z" fill="currentColor" fill-opacity="0.14"/><path d="M54 52V40h16v12"/><path d="M52 40l10-12 10 12z"/><path d="M56 64h12M54 80h16"/><path d="M24 102h72"/><path d="M46 36L26 30M78 36l20-6M46 46l-22 3M78 46l22 3"/></svg>`,
  `<svg viewBox="0 0 120 120"><path d="M60 98C30 78 24 56 36 42c9-10 20-6 24 4 4-10 15-14 24-4 12 14 6 36-24 56z" fill="currentColor" fill-opacity="0.14"/></svg>`,
];
const SIMULADOS = [...EXEMPLOS.map((e) => e.svg), ...EXTRA].map((x) => sanitizarSvg(x)).filter((x): x is string => x !== null);

const moderadorSimulado: Moderador = {
  configurado: () => true,
  imagem: async () => ({ ok: true, motivo: "ok" }),
  texto: async (t) => (t.includes("RECUSAR") ? { ok: false, motivo: "assedio" } : { ok: true, motivo: "ok" }),
};
const ilustradorSimulado: Ilustrador = {
  configurado: () => true,
  gerar: async (titulo) => SIMULADOS[[...titulo].reduce((a, c) => a + c.charCodeAt(0), 0) % SIMULADOS.length] ?? null,
};

export function criarEstante(pool: Pool): EstanteService {
  if (process.env.ORVOK_ESTANTE_SIMULADA === "1" && process.env.APP_ENV === "development") return new EstanteService(pool, moderadorSimulado, ilustradorSimulado);
  return new EstanteService(pool);
}

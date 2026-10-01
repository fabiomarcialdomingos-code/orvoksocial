import type { Traco } from "./nucleo";

/**
 * Como cada traço tende a ser mais bem percebido: por quem vive por dentro
 * (interno) ou por quem observa de fora (observável). Inspirado no modelo
 * self-other knowledge asymmetry (SOKA), de Simine Vazire (2010): traços
 * mais visíveis no comportamento tendem a ser percebidos tão bem (ou melhor)
 * por quem está de fora; traços mais internos tendem a ser mais bem
 * conhecidos por quem os vive. É um padrão geral de pesquisa, não um
 * diagnóstico sobre esta pessoa — por isso as frases usam "costuma", nunca
 * uma afirmação fechada sobre quem está respondendo.
 */
export const VISIBILIDADE: Record<Traco, "observavel" | "interno"> = {
  social: "observavel",
  ritmo: "observavel",
  novidade: "observavel",
  decisao: "interno",
  reacao: "interno",
  foco: "interno",
};

const NOTA = {
  observavel: "Esse é um traço visível no dia a dia. Pesquisas sobre percepção social mostram que, nesses casos, quem está por fora costuma enxergar tão bem quanto a própria pessoa — às vezes até melhor.",
  interno: "Esse é um traço mais interno. Pesquisas mostram que, nesses casos, a própria pessoa costuma se conhecer melhor do que quem está de fora — talvez isso apareça diferente por fora do que é por dentro.",
} as const;

/** Nota para um traço divergente (≠), ou null quando os dois lados batem. */
export function notaSobrePercepcao(traco: Traco, bate: boolean): string | null {
  return bate ? null : NOTA[VISIBILIDADE[traco]];
}

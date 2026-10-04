import { NUCLEO, ORDEM_TRACOS, type PerguntaNucleo, type Relacao as Contexto } from "./nucleo";

/**
 * Seleção das 12 perguntas do retrato: 2 de cada um dos 6 traços, para o
 * perfil sair consistente. Perguntas de outra relação nunca entram.
 */
export type Estatistica = { tentativas: number; acertos: number; distribuicao: [number, number, number, number] };
const MIN_AMOSTRA = 15;
const ALVO_ACERTO = 0.55;

const porChaveNucleo = new Map(NUCLEO.map((p) => [p.chave, p]));
export const perguntaPorChave = (chave: string): PerguntaNucleo | undefined => porChaveNucleo.get(chave);

/** 0 a 1. Sem dados suficientes, nota neutra com leve incentivo para testar a pergunta. */
export function qualidade(e: Estatistica | undefined): number {
  if (!e || e.tentativas < MIN_AMOSTRA) return 0.6;
  const taxa = e.acertos / e.tentativas;
  const equilibrio = Math.max(0, 1 - Math.abs(taxa - ALVO_ACERTO) / 0.45);
  const total = e.distribuicao.reduce((s, n) => s + n, 0) || 1;
  const entropia = -e.distribuicao.reduce((s, n) => (n ? s + (n / total) * Math.log2(n / total) : s), 0) / 2;
  return equilibrio * 0.6 + entropia * 0.4;
}

/** Confere um conjunto enviado pelo navegador: as 12 chaves únicas do núcleo, da relação certa. */
export function conjuntoValido(chaves: string[], contexto?: Contexto): boolean {
  return chaves.length === TOTAL_PERGUNTAS && new Set(chaves).size === chaves.length
    && chaves.every((c) => { const p = porChaveNucleo.get(c); return Boolean(p) && (!contexto || !p!.contexto || p!.contexto === contexto); });
}

export const TOTAL_PERGUNTAS = 12;
const serveNucleo = (p: PerguntaNucleo, contexto: Contexto) => !p.contexto || p.contexto === contexto;

/** As 12 perguntas do retrato: 2 de cada traço. */
export function escolherRetrato(contexto: Contexto, estatisticas: Map<string, Estatistica>, sorte: () => number = Math.random): PerguntaNucleo[] {
  const lista: PerguntaNucleo[] = [];
  for (const t of ORDEM_TRACOS) {
    NUCLEO.filter((p) => p.traco === t && !p.d && serveNucleo(p, contexto))
      .map((p) => ({ p, n: qualidade(estatisticas.get(p.chave)) + (p.contexto ? 0.3 : 0) + sorte() * 0.5 }))
      .sort((a, b) => b.n - a.n).slice(0, 2).forEach((x) => lista.push(x.p));
  }
  // Intercala os traços para a pessoa não responder duas perguntas iguais seguidas.
  return [...lista.filter((_, i) => i % 2 === 0), ...lista.filter((_, i) => i % 2 === 1)];
}

/** Texto da pergunta para quem responde (`você`) ou para quem prevê (primeiro nome). */
export function textoPara(p: { texto: string }, quem: string | null): string {
  const t = p.texto.replace(/\{voce\}/g, quem ?? "você");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

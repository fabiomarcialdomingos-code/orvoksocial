import { NUCLEO, ORDEM_TRACOS, type PerguntaNucleo, type Relacao as Contexto, type Traco as TracoNucleo } from "./nucleo";

/**
 * Seleção das 10 perguntas do desafio a partir do núcleo do perfil:
 * 6 de abertura (uma por traço) e 4 de reforço nos traços em que a pessoa
 * ficou mais em cima do muro. Perguntas de outra relação nunca entram.
 */
export type Estatistica = { tentativas: number; acertos: number; distribuicao: [number, number, number, number] };
const MIN_AMOSTRA = 15;
const ALVO_ACERTO = 0.55;

const porChaveNucleo = new Map(NUCLEO.map((p) => [p.chave, p]));
export const perguntaPorChave = (chave: string): PerguntaNucleo | undefined => porChaveNucleo.get(chave);

function embaralhar<T>(lista: T[], sorte: () => number): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(sorte() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/** 0 a 1. Sem dados suficientes, nota neutra com leve incentivo para testar a pergunta. */
export function qualidade(e: Estatistica | undefined): number {
  if (!e || e.tentativas < MIN_AMOSTRA) return 0.6;
  const taxa = e.acertos / e.tentativas;
  const equilibrio = Math.max(0, 1 - Math.abs(taxa - ALVO_ACERTO) / 0.45);
  const total = e.distribuicao.reduce((s, n) => s + n, 0) || 1;
  const entropia = -e.distribuicao.reduce((s, n) => (n ? s + (n / total) * Math.log2(n / total) : s), 0) / 2;
  return equilibrio * 0.6 + entropia * 0.4;
}

/** Confere um conjunto enviado pelo navegador: 5 (desafio) ou 12 (retrato) chaves únicas do núcleo, da relação certa. */
export function conjuntoValido(chaves: string[], contexto?: Contexto, tipo?: "desafio" | "retrato"): boolean {
  const tamanho = tipo === "retrato" ? 12 : tipo === "desafio" ? 5 : chaves.length;
  return (chaves.length === 5 || chaves.length === 12) && chaves.length === tamanho && new Set(chaves).size === chaves.length
    && chaves.every((c) => { const p = porChaveNucleo.get(c); return Boolean(p) && (!contexto || !p!.contexto || p!.contexto === contexto); });
}

/* ---------- Dois produtos ----------
 * Desafio (quanto te conhecem): 5 perguntas, de 5 traços diferentes, leves,
 *   preferindo as da relação e as divertidas. O amigo tenta adivinhar.
 * Retrato (como te veem): 12 perguntas, 2 de cada traço, para o perfil sair
 *   consistente. O amigo diz como enxerga a pessoa.
 */
export type Tipo = "desafio" | "retrato";
export const TOTAL_POR_TIPO: Record<Tipo, number> = { desafio: 5, retrato: 12 };
const serveNucleo = (p: PerguntaNucleo, contexto: Contexto) => !p.contexto || p.contexto === contexto;

export function escolherDesafio(contexto: Contexto, estatisticas: Map<string, Estatistica>, sorte: () => number = Math.random): PerguntaNucleo[] {
  const tracos = embaralhar(ORDEM_TRACOS, sorte).slice(0, TOTAL_POR_TIPO.desafio);
  const lista = tracos.map((t: TracoNucleo, i) => {
    const ultima = i === tracos.length - 1;
    return NUCLEO.filter((p) => p.traco === t && serveNucleo(p, contexto))
      .map((p) => ({ p, n: qualidade(estatisticas.get(p.chave)) + (p.contexto ? 0.4 : 0) + (p.d ? (ultima ? 0.8 : 0.3) : 0) + sorte() * 0.4 }))
      .sort((a, b) => b.n - a.n)[0]!.p;
  });
  return lista;
}

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

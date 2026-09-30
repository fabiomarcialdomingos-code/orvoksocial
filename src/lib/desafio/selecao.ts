import { NUCLEO, ORDEM_TRACOS, type PerguntaNucleo, type Relacao as Contexto, type Traco as TracoNucleo } from "./nucleo";
import { notas } from "./perfil";

/**
 * Seleção das 10 perguntas do desafio a partir do núcleo do perfil:
 * 6 de abertura (uma por traço) e 4 de reforço nos traços em que a pessoa
 * ficou mais em cima do muro. Perguntas de outra relação nunca entram.
 */
export type Estatistica = { tentativas: number; acertos: number; distribuicao: [number, number, number, number] };
export const TOTAL_PERGUNTAS = 10;
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

/** Confere um conjunto enviado pelo navegador: 10 chaves únicas do núcleo, da relação certa. */
export function conjuntoValido(chaves: string[], contexto?: Contexto): boolean {
  return chaves.length === TOTAL_PERGUNTAS && new Set(chaves).size === chaves.length
    && chaves.every((c) => { const p = porChaveNucleo.get(c); return Boolean(p) && (!contexto || !p!.contexto || p!.contexto === contexto); });
}

/* ---------- Núcleo do perfil: 6 de abertura (um por traço) + 4 de reforço ---------- */
const serveNucleo = (p: PerguntaNucleo, contexto: Contexto) => !p.contexto || p.contexto === contexto;

/** Abertura: uma pergunta de cada traço, sem as divertidas, em ordem aleatória. */
export function escolherAberturaNucleo(contexto: Contexto, estatisticas: Map<string, Estatistica>, sorte: () => number = Math.random): PerguntaNucleo[] {
  return embaralhar(ORDEM_TRACOS, sorte).map((t) => {
    const candidatas = NUCLEO.filter((p) => p.traco === t && !p.d && serveNucleo(p, contexto));
    return candidatas.map((p) => ({ p, n: qualidade(estatisticas.get(p.chave)) + (p.contexto ? 0.2 : 0) + sorte() * 0.5 })).sort((a, b) => b.n - a.n)[0]!.p;
  });
}

/**
 * Reforço: depois das 6, mais 4 perguntas nos traços em que a pessoa ficou mais
 * em cima do muro, para o perfil sair mais preciso. Prefere perguntas da relação
 * escolhida e fecha com uma divertida quando houver.
 */
export function escolherReforcoNucleo(abertura: { chave: string; opcao: number }[], contexto: Contexto, estatisticas: Map<string, Estatistica>, sorte: () => number = Math.random): PerguntaNucleo[] {
  const n = notas(abertura.map((a) => a.chave), abertura.map((a) => a.opcao));
  const usados = new Set(abertura.map((a) => a.chave));
  const alvo = [...ORDEM_TRACOS].sort((a, b) => Math.abs(n[a] ?? 0) - Math.abs(n[b] ?? 0) || sorte() - 0.5).slice(0, TOTAL_PERGUNTAS - 6);
  const escolhidas: PerguntaNucleo[] = [];
  alvo.forEach((t: TracoNucleo, i) => {
    const ultima = i === alvo.length - 1;
    const candidatas = NUCLEO.filter((p) => p.traco === t && !usados.has(p.chave) && serveNucleo(p, contexto));
    const melhor = candidatas.map((p) => ({ p, n: qualidade(estatisticas.get(p.chave)) + (p.contexto ? 0.4 : 0) + (ultima && p.d ? 0.6 : 0) + sorte() * 0.3 })).sort((a, b) => b.n - a.n)[0];
    if (melhor) { escolhidas.push(melhor.p); usados.add(melhor.p.chave); }
  });
  return escolhidas;
}

/** Texto da pergunta para quem responde (`você`) ou para quem prevê (primeiro nome). */
export function textoPara(p: { texto: string }, quem: string | null): string {
  const t = p.texto.replace(/\{voce\}/g, quem ?? "você");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

import { BANCO, type Contexto, type Eixo, type PerguntaBanco, type Tema, type Traco } from "./banco";
import { NUCLEO, ORDEM_TRACOS, type PerguntaNucleo, type Traco as TracoNucleo } from "./nucleo";
import { notas } from "./perfil";

/**
 * Seleção das 10 perguntas de cada pessoa.
 *
 * 1. Abertura: 3 âncoras leves, uma por eixo (social, ritmo, cabeça), de temas
 *    diferentes. As respostas formam o perfil da pessoa.
 * 2. Depois: 7 perguntas, uma de cada tema restante. Cada candidata recebe uma
 *    nota que soma
 *      - qualidade aprendida com o uso (amigos acertam entre 40% e 70%, e as
 *        respostas se espalham entre as opções);
 *      - bônus quando a pergunta divide pessoas com o mesmo perfil (evita o óbvio);
 *      - um pouco de sorte, para variar entre pessoas.
 *    Uma divertida fecha o desafio; as demais vão da mais leve à mais profunda.
 * 3. Relação escolhida (família, amigos ou crush): entram as perguntas gerais e
 *    as daquela relação, que recebem um bônus para aparecer bastante. Perguntas
 *    de outra relação nunca entram.
 */
export type Estatistica = { tentativas: number; acertos: number; distribuicao: [number, number, number, number] };
export type Perfil = Partial<Record<Eixo, Traco>>;
export const TOTAL_PERGUNTAS = 10;
const QTD_ANCORAS = 3;
const MIN_AMOSTRA = 15;
const ALVO_ACERTO = 0.55;

const porChave = new Map(BANCO.map((p) => [p.chave, p]));
const porChaveNucleo = new Map(NUCLEO.map((p) => [p.chave, p]));
/** Procura no núcleo novo e no banco antigo (desafios antigos continuam funcionando). */
export const perguntaPorChave = (chave: string): { chave: string; texto: string; opcoes: [string, string, string, string]; contexto?: Contexto } | undefined =>
  porChaveNucleo.get(chave) ?? porChave.get(chave);

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

export function escolherAncoras(sorte: () => number = Math.random): PerguntaBanco[] {
  const escolhidas: PerguntaBanco[] = [];
  const temas = new Set<Tema>();
  for (const eixo of embaralhar<Eixo>(["social", "ritmo", "cabeca"], sorte)) {
    const opcoes = embaralhar(BANCO.filter((p) => p.ancora?.eixo === eixo && !temas.has(p.tema)), sorte);
    const p = opcoes[0];
    if (p) { escolhidas.push(p); temas.add(p.tema); }
  }
  return escolhidas.slice(0, QTD_ANCORAS);
}

export function perfilDasAncoras(respostas: { chave: string; opcao: number }[]): Perfil {
  const perfil: Perfil = {};
  for (const r of respostas) {
    const a = porChave.get(r.chave)?.ancora;
    const traco = a?.mapa[r.opcao];
    if (a && traco) perfil[a.eixo] = traco;
  }
  return perfil;
}

const BONUS_RELACAO = 0.3;
const servePara = (p: PerguntaBanco, contexto: Contexto) => !p.contexto || p.contexto === contexto;

export function escolherRestantes(
  ancoras: string[], perfil: Perfil, estatisticas: Map<string, Estatistica>, contexto: Contexto, sorte: () => number = Math.random,
): PerguntaBanco[] {
  const usados = new Set(ancoras.map((c) => porChave.get(c)?.tema));
  const tracos = new Set(Object.values(perfil));
  const nota = (p: PerguntaBanco) => qualidade(estatisticas.get(p.chave)) + (p.para && tracos.has(p.para) ? 0.25 : 0)
    + (p.contexto ? BONUS_RELACAO : 0) + sorte() * 0.25;
  const livres = (tema: Tema) => BANCO.filter((p) => p.tema === tema && !p.ancora && !ancoras.includes(p.chave) && servePara(p, contexto));
  const temas = embaralhar((Object.keys(TEMAS_ORDEM) as Tema[]).filter((t) => !usados.has(t)), sorte);

  // A divertida que fecha: a melhor entre os temas restantes.
  const divertidas = temas.flatMap((t) => livres(t).filter((p) => p.d)).map((p) => ({ p, n: nota(p) })).sort((a, b) => b.n - a.n);
  const final = divertidas[0]?.p;
  const meio = temas.filter((t) => t !== final?.tema).map((t) => {
    const candidatas = livres(t).filter((p) => !p.d || !final).map((p) => ({ p, n: nota(p) })).sort((a, b) => b.n - a.n);
    return candidatas[0]?.p;
  }).filter((p): p is PerguntaBanco => Boolean(p));
  const ordenadas = meio.sort((a, b) => a.nivel - b.nivel).slice(0, TOTAL_PERGUNTAS - QTD_ANCORAS - (final ? 1 : 0));
  return final ? [...ordenadas, final] : ordenadas;
}

const TEMAS_ORDEM: Record<Tema, true> = {
  decisoes: true, "tempo-livre": true, relacoes: true, dinheiro: true, social: true,
  imprevistos: true, rotina: true, emocoes: true, gostos: true, futuro: true,
};

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

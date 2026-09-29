import { BANCO, type Eixo, type PerguntaBanco, type Tema, type Traco } from "./banco";

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
 */
export type Estatistica = { tentativas: number; acertos: number; distribuicao: [number, number, number, number] };
export type Perfil = Partial<Record<Eixo, Traco>>;
export const TOTAL_PERGUNTAS = 10;
const QTD_ANCORAS = 3;
const MIN_AMOSTRA = 15;
const ALVO_ACERTO = 0.55;

const porChave = new Map(BANCO.map((p) => [p.chave, p]));
export const perguntaPorChave = (chave: string) => porChave.get(chave);

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

export function escolherRestantes(
  ancoras: string[], perfil: Perfil, estatisticas: Map<string, Estatistica>, sorte: () => number = Math.random,
): PerguntaBanco[] {
  const usados = new Set(ancoras.map((c) => porChave.get(c)?.tema));
  const tracos = new Set(Object.values(perfil));
  const nota = (p: PerguntaBanco) => qualidade(estatisticas.get(p.chave)) + (p.para && tracos.has(p.para) ? 0.25 : 0) + sorte() * 0.25;
  const livres = (tema: Tema) => BANCO.filter((p) => p.tema === tema && !p.ancora && !ancoras.includes(p.chave));
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

/** Confere se um conjunto enviado pelo navegador é válido: 10 chaves únicas do banco. */
export function conjuntoValido(chaves: string[]): boolean {
  return chaves.length === TOTAL_PERGUNTAS && new Set(chaves).size === chaves.length && chaves.every((c) => porChave.has(c));
}

/** Texto da pergunta para quem responde (`você`) ou para quem prevê (primeiro nome). */
export function textoPara(p: PerguntaBanco, quem: string | null): string {
  const t = p.texto.replace(/\{voce\}/g, quem ?? "você");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

import { NUCLEO, ORDEM_TRACOS, TRACOS, type PerguntaNucleo, type Traco } from "./nucleo";

/**
 * Perfil a partir das respostas. Cada traço vira uma nota de -1 a +1
 * (positivo = primeiro polo). O perfil principal sai de social, ritmo e
 * decisão (8 nomes); reação, novidade e foco viram "traços marcantes".
 * É um jogo de autoconhecimento, não uma avaliação psicológica.
 */
export type Notas = Record<Traco, number | null>;
const porChave = new Map(NUCLEO.map((p) => [p.chave, p]));
export const perguntaNucleo = (chave: string) => porChave.get(chave);

export function notas(chaves: string[], opcoes: number[]): Notas {
  const soma: Record<Traco, number> = { social: 0, ritmo: 0, decisao: 0, reacao: 0, novidade: 0, foco: 0 };
  const qtd: Record<Traco, number> = { social: 0, ritmo: 0, decisao: 0, reacao: 0, novidade: 0, foco: 0 };
  chaves.forEach((c, i) => {
    const p = porChave.get(c), o = opcoes[i];
    if (!p || o === undefined || o < 0 || o > 3) return;
    soma[p.traco] += p.pesos[o]!; qtd[p.traco] += 2;
  });
  return Object.fromEntries(ORDEM_TRACOS.map((t) => [t, qtd[t] ? soma[t] / qtd[t] : null])) as Notas;
}

/** Média das notas de várias pessoas (o "como te veem"). */
export function media(lista: Notas[]): Notas {
  return Object.fromEntries(ORDEM_TRACOS.map((t) => {
    const v = lista.map((n) => n[t]).filter((x): x is number => x !== null);
    return [t, v.length ? v.reduce((a, b) => a + b, 0) / v.length : null];
  })) as Notas;
}

const ARQUETIPOS: Record<string, { nome: string; frase: string }> = {
  "+++": { nome: "O Líder", frase: "Você puxa a conversa, planeja o caminho e decide com a cabeça." },
  "++-": { nome: "O Anfitrião", frase: "Você reúne as pessoas, organiza tudo e faz cada um se sentir em casa." },
  "+-+": { nome: "O Aventureiro", frase: "Você chega puxando conversa, decide na hora e confia na lógica." },
  "+--": { nome: "O Espírito Livre", frase: "Você vive o momento, faz amizade fácil e segue o coração." },
  "-++": { nome: "O Estrategista", frase: "Você observa antes de agir, planeja cada passo e pensa com frieza." },
  "-+-": { nome: "O Guardião", frase: "Você é discreto, confiável e protege quem ama com cuidado." },
  "--+": { nome: "O Observador", frase: "Você enxerga o que ninguém vê, age na hora certa e pensa com clareza." },
  "---": { nome: "O Sonhador", frase: "Você tem um mundo rico por dentro, vive o presente e sente tudo com o coração." },
};
const FRASES: Record<Traco, [string, string]> = {
  social: ["chega puxando conversa", "observa antes de se abrir"],
  ritmo: ["planeja antes de agir", "decide na hora"],
  decisao: ["confia na lógica", "segue o coração"],
  reacao: ["mantém a calma quando tudo aperta", "sente tudo com força"],
  novidade: ["vive atrás de novidade", "valoriza o conforto do que conhece"],
  foco: ["gosta de resolver as coisas do próprio jeito", "está sempre de olho em quem ama"],
};

export type Perfil = {
  nome: string; frase: string; descricao: string;
  tracos: { traco: Traco; nome: string; polo: string; forca: number }[];
  marcantes: string[];
};

/** Perfil legível: nome, descrição e a força (50% a 100%) de cada traço. */
export function perfil(n: Notas): Perfil {
  const lado = (t: Traco) => ((n[t] ?? 0) >= 0 ? 0 : 1);
  const chave = (["social", "ritmo", "decisao"] as Traco[]).map((t) => (lado(t) === 0 ? "+" : "-")).join("");
  const a = ARQUETIPOS[chave]!;
  const tracos = ORDEM_TRACOS.map((t) => ({ traco: t, nome: TRACOS[t].nome, polo: TRACOS[t].polos[lado(t)]!, forca: Math.round(50 + Math.abs(n[t] ?? 0) * 50) }));
  const frases = ORDEM_TRACOS.map((t) => FRASES[t][lado(t)]!);
  const descricao = `Você ${frases.slice(0, 5).join(", ")} e ${frases[5]}.`;
  return { nome: a.nome, frase: a.frase, descricao, tracos, marcantes: tracos.slice(3).map((x) => x.polo) };
}

/** Quantos traços batem entre como a pessoa se vê e como a veem, e o selo correspondente. */
export function selo(eu: Notas, eles: Notas) {
  const batem = ORDEM_TRACOS.filter((t) => ((eu[t] ?? 0) >= 0) === ((eles[t] ?? 0) >= 0)).length;
  const nivel = batem === 6 ? "autentico" : batem === 5 ? "prata" : batem === 4 ? "bronze" : null;
  const titulo = { autentico: "Selo Autêntico", prata: "Selo Prata", bronze: "Selo Bronze" } as const;
  const frase = { autentico: "Você é exatamente quem acha que é.", prata: "Quase transparente: as pessoas te veem quase como você se vê.", bronze: "As pessoas te conhecem bem." } as const;
  return { batem, nivel, titulo: nivel ? titulo[nivel] : null, frase: nivel ? frase[nivel] : "Aqui as pessoas te veem diferente de como você se vê." };
}

export type { PerguntaNucleo };

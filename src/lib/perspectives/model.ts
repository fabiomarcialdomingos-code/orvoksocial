import catalog from "./catalog.json";
export const TOPICS = {
  decisoes: "Escolhas",
  comunicacao: "Conversas",
  rotina: "Meu dia a dia",
  amizades: "Amizades",
  interesses: "Interesses",
  planos: "Planos",
  trabalho: "Trabalho",
  afeto: "Afeto",
  familia: "Família",
  mundo: "O mundo",
} as const;
export type Topic = keyof typeof TOPICS;
export const RELATIONS = {
  geral: "Outra pessoa",
  pai: "Pai",
  mae: "Mãe",
  irmao: "Irmão ou irmã",
  amigo: "Amigo ou amiga",
  crush: "Crush",
  parceiro: "Parceiro ou parceira",
  colega: "Colega",
} as const;
export type Relationship = keyof typeof RELATIONS;
export type Question = {
  id: string;
  version: number;
  topic: string;
  anchor: boolean;
  text: string;
  options: { id: string; label: string }[];
};
export const CATALOG: readonly Question[] = catalog;
export const CATALOG_VERSION = "perspectivas-2026-09-v1";
export const CONSENT_VERSION = "perspectivas-v1";
export const SELF_NOTICE =
  "Autorizo guardar minhas respostas para comparar com previsões de pessoas que eu convidar. Minhas respostas não são públicas. Cada convite preserva uma cópia das minhas escolhas. Posso encerrar conexões e solicitar exclusão dos dados em Privacidade.";
export const SHARE_NOTICE =
  "Autorizo a pessoa que aceitar este link individual a prever minhas respostas e vê-las após concluir a rodada. Posso encerrar a conexão e ocultar os resultados a qualquer momento.";
export const INVITE_NOTICE =
  "Aceito esta comparação privada. Minhas previsões e, nos eventos, minha própria escolha serão reveladas aos dois participantes após a confirmação. Posso encerrar a conexão a qualquer momento.";
export type Preferences = {
  interests: Topic[];
  age: number | null;
  profession: string;
  showAge: boolean;
  showProfession: boolean;
};
export const EMPTY_PREFERENCES: Preferences = {
  interests: [],
  age: null,
  profession: "",
  showAge: false,
  showProfession: false,
};
export type Round = {
  id: string;
  kind: "initial" | "relationship" | "daily";
  relationship: Relationship;
  questions: Question[];
  answers: Record<string, string>;
  skipped: string[];
  sealedAt: string | null;
  createdAt: string;
};
export type Guess = {
  optionId: string;
  confidence: number;
  previouslyRevealed?: boolean;
};
export type Connection = {
  id: string;
  code: string;
  kind: "people" | "world";
  title: string;
  ownerId: string;
  guestId: string | null;
  ownerName: string;
  guestName: string | null;
  relationship?: Relationship;
  state: "pending" | "accepted" | "completed" | "revoked" | "expired";
  isOwner: boolean;
  eventId: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string;
  needsAcceptance?: boolean;
  questions?: Question[];
  answers?: Record<string, string>;
  guesses?: Record<string, Guess>;
  ownWorldChoice?: string | null;
  worldOptions?: { id: string; label: string }[];
  resolution?: {
    state: string;
    outcomeOpportunityId: string | null;
    rationale: string;
  } | null;
  messages?: {
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
  }[];
};
const affinities: Record<Relationship, Topic[]> = {
  geral: [],
  pai: ["familia", "planos"],
  mae: ["familia", "planos"],
  irmao: ["familia", "rotina"],
  amigo: ["amizades", "interesses"],
  crush: ["afeto", "comunicacao"],
  parceiro: ["afeto", "planos"],
  colega: ["trabalho", "decisoes"],
};
function hash(value: string) {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
/** Reproducible selection, based only on declared interests and relationship. */
export function selectQuestions(input: {
  seed: string;
  interests: readonly string[];
  relationship: Relationship;
  seen?: readonly string[];
  count?: number;
}): Question[] {
  const count = input.count ?? 12,
    seen = new Set(input.seen ?? []),
    pool = CATALOG.filter((q) => !seen.has(q.id)),
    selected: Question[] = [];
  const counts = new Map<string, number>(),
    preferred = new Set([
      ...input.interests,
      ...affinities[input.relationship],
    ]);
  const add = (q: Question) => {
    selected.push(q);
    counts.set(q.topic, (counts.get(q.topic) ?? 0) + 1);
  };
  if (count === 12)
    pool
      .filter((q) => q.anchor)
      .slice(0, 4)
      .forEach(add);
  while (selected.length < Math.min(count, pool.length)) {
    const explore = selected.length >= count - Math.min(2, count);
    const score = (q: Question) =>
      (preferred.has(q.topic) !== explore ? 4 : 0) -
      (counts.get(q.topic) ?? 0) * 3 +
      hash(input.seed + q.id) / 4294967296;
    const next = pool
      .filter((q) => !selected.some((s) => s.id === q.id))
      .sort((a, b) => score(b) - score(a))[0];
    if (!next) break;
    add(next);
  }
  return selected;
}
export function assess(
  questions: Question[],
  answers: Record<string, string>,
  guesses: Record<string, Guess>,
) {
  const rows = questions.flatMap((q) => {
    const a = answers[q.id],
      g = guesses[q.id];
    return !a || !g
      ? []
      : [
          {
            question: q,
            answer: a,
            guess: g.optionId,
            hit: a === g.optionId,
            previouslyRevealed: g.previouslyRevealed === true,
          },
        ];
  });
  const fresh = rows.filter((r) => !r.previouslyRevealed);
  return { rows, total: fresh.length, hits: fresh.filter((r) => r.hit).length };
}

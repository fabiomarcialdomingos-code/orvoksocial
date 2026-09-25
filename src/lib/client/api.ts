"use client";

/** Thin client for /api/v1. Same-origin cookies, idempotent POSTs, and
 *  error codes translated into sentences the interface can show as-is. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

const messages: Record<string, string> = {
  UNAUTHENTICATED: "Sua sessão terminou. Entre novamente para continuar.",
  FORBIDDEN: "Esta conta não tem permissão para esta ação.",
  NOT_FOUND: "Não encontramos o que você procurou.",
  CONFLICT: "Isso já foi feito ou mudou enquanto você usava a página. Atualize e tente de novo.",
  RULE_VIOLATION: "A regra desta etapa não permite a ação agora.",
  VALIDATION_ERROR: "Confira os campos e tente de novo.",
  RATE_LIMITED: "Muitas ações em sequência. Aguarde um minuto.",
  PAYLOAD_TOO_LARGE: "O conteúdo é grande demais.",
  TEST_CATALOG_IN_DEPLOYED_ENVIRONMENT: "O Radar ainda não está disponível neste ambiente.",
};

export function describeError(error: unknown, fallback = "Não foi possível concluir. Tente de novo."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "Sem conexão com o servidor. Verifique sua internet.";
  return fallback;
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    const code = (data as { code?: string })?.code ?? "UNKNOWN";
    throw new ApiError(response.status, code, messages[code] ?? "Não foi possível concluir. Tente de novo.");
  }
  return data as T;
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { credentials: "same-origin", cache: "no-store", signal: signal ?? null });
  return parse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  return parse<T>(response);
}

/* ---------- Shared types ---------- */
export type Session = { authenticated: boolean; userId?: string; role?: "USER" | "MODERATOR" | "ADMIN" };
export type Profile = { userId: string; displayName: string; avatarUrl?: string | null; bio?: string | null };
export type Option = { id: string; label: string; position: number };
export type Question = { questionVersionId: string; text: string; options: Option[] };
export type Answer = { id: string; questionVersionId: string; optionId: string; version: number; answeredAt: string };
export type Consent = { id: string; purpose: "SELF_ANSWER" | "BE_PREDICTED"; scope: string; invitationAcceptanceId: string | null; noticeVersion: string; consentVersion: number; grantedAt: string; revokedAt: string | null };
export type Invitation = { id: string; predictorId: string; targetId: string; invitedAt: string; expiresAt: string | null; acceptanceId: string | null; acceptedAt: string | null };
export type Notice = { presentationId: string; version: string; contentHash: string; content: string };
export type Opportunity = { targetId: string; grantId: string; questionVersionId: string; selfAnswerVersionId: string };
export type Dashboard = {
  made: { id: string; targetId: string; questionVersionId: string; predictedAt: string }[];
  received: { id: string; predictorId: string; questionVersionId: string; predictedAt: string }[];
  pendingInvitations: { id: string; predictorId: string; invitedAt: string }[];
  matches: { userId: string; mutualAt: string }[];
};
export type WorldEvent = {
  id: string; title: string; description?: string | null; sourceUrl?: string | null; resolutionCriteria: string;
  opensAt: string; closesAt: string; status: string; category: string;
  opportunities: { id: string; code: string; label: string; position: number }[];
};
export type Post = { id: string; authorId: string; body: string; createdAt: string; commentCount: number; reactionCount: number };
export type Group = { id: string; ownerId: string; name: string; description?: string | null; createdAt: string };

/* ---------- Helpers ---------- */
export function initials(name?: string | null): string {
  if (!name) return "··";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

const people = new Map<string, Profile>();
export async function loadPeople(ids: string[]): Promise<Map<string, Profile>> {
  const missing = [...new Set(ids)].filter((id) => id && !people.has(id));
  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50);
    const result = await apiGet<{ items: Profile[] }>(`/people?ids=${chunk.join(",")}`);
    for (const item of result.items) people.set(item.userId, item);
  }
  return people;
}
export function personName(map: Map<string, Profile>, id: string): string {
  return map.get(id)?.displayName ?? "Pessoa sem nome";
}

export function relativeTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = (date.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Latest answer version per question. */
export function latestAnswers(answers: Answer[]): Map<string, Answer> {
  const map = new Map<string, Answer>();
  for (const answer of answers) {
    const current = map.get(answer.questionVersionId);
    if (!current || answer.version > current.version) map.set(answer.questionVersionId, answer);
  }
  return map;
}

export async function getAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i += 1) {
    const sep = path.includes("?") ? "&" : "?";
    const page: { items: T[]; nextCursor?: string | null } = await apiGet(cursor ? `${path}${sep}cursor=${encodeURIComponent(cursor)}` : path);
    items.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return items;
}

import { randomUUID } from "node:crypto";

/**
 * End-to-end simulation over HTTP. Creates people, walks the whole Radar
 * journey (self answers, request, acceptance, consent, predictions, encounter),
 * the World cycle (admin draft, publish, predictions, comments), the social
 * layer (profiles, posts, groups) and a set of negative checks for privacy
 * boundaries. Requires a running app (BASE_URL) and `pnpm db:seed:demo`.
 *
 *   BASE_URL=http://localhost:3000 pnpm test:e2e
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@orvok.test";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Orvok#Admin2026";
const PASSWORD = "Perspectiva#2026";
const run = process.env.SIM_RUN ?? Date.now().toString(36);

type Json = Record<string, unknown>;
const results: { name: string; ok: boolean; detail?: string | undefined }[] = [];

class Client {
  cookie = "";
  userId = "";
  constructor(readonly label: string, readonly email: string) {}
  async call<T = Json>(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = { Origin: BASE };
    if (this.cookie) headers.Cookie = this.cookie;
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      headers["Idempotency-Key"] = randomUUID();
    }
    const response = await fetch(BASE + path, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body ?? {}) : null,
      redirect: "manual",
    });
    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const line of setCookie) {
      const pair = line.split(";")[0]!;
      if (pair.endsWith("=")) continue;
      const name = pair.split("=")[0]!;
      const others = this.cookie.split("; ").filter((item) => item && !item.startsWith(name + "="));
      this.cookie = [...others, pair].join("; ");
    }
    const text = await response.text();
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
    return { status: response.status, data: data as T };
  }
  get = <T = Json>(path: string) => this.call<T>("GET", path);
  post = <T = Json>(path: string, body?: unknown) => this.call<T>("POST", path, body);
}

function check(name: string, ok: boolean, detail?: unknown) {
  results.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail)?.slice(0, 400) });
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + JSON.stringify(detail)?.slice(0, 400)}`);
}

async function signUp(label: string, displayName: string, bio: string) {
  const client = new Client(label, `${label}.${run}@orvok.test`);
  const reg = await client.post("/api/v1/auth/register", { email: client.email, password: PASSWORD });
  check(`${label}: cadastro aceito`, reg.status === 202, reg);
  const login = await client.post<{ userId: string }>("/api/v1/auth/login", { email: client.email, password: PASSWORD });
  check(`${label}: login`, login.status === 200 && Boolean(login.data.userId), login);
  client.userId = login.data.userId;
  const profile = await client.post("/api/v1/social/profile", { displayName, bio });
  check(`${label}: perfil salvo`, profile.status === 200, profile);
  return client;
}

type Question = { questionVersionId: string; text: string; options: { id: string; label: string; position: number }[] };

async function answerAll(client: Client, pick: (index: number) => number) {
  const notice = await client.get<{ presentationId: string; version: string; contentHash: string }>("/api/v1/consent-notice?purpose=SELF_ANSWER");
  check(`${client.label}: aviso de respostas próprias apresentado`, notice.status === 200 && Boolean(notice.data.presentationId), notice);
  const grant = await client.post<{ grantId: string }>("/api/v1/radar/self-answer-consents", {
    presentationId: notice.data.presentationId, accepted: true, noticeVersion: notice.data.version, noticeHash: notice.data.contentHash,
  });
  check(`${client.label}: consentimento de respostas próprias`, grant.status === 201, grant);
  const questions = await client.get<{ items: Question[] }>("/api/v1/radar/questions");
  check(`${client.label}: catálogo com 12 perguntas`, questions.data.items?.length === 12, questions.data);
  let answered = 0;
  for (const [index, question] of questions.data.items.entries()) {
    const option = [...question.options].sort((a, b) => a.position - b.position)[pick(index)]!;
    const answer = await client.post("/api/v1/radar/answers", { questionVersionId: question.questionVersionId, optionId: option.id, consentGrantId: grant.data.grantId });
    if (answer.status === 201) answered += 1; else check(`${client.label}: resposta ${index + 1}`, false, answer);
  }
  check(`${client.label}: respondeu o gabarito completo`, answered === 12, { answered });
  return questions.data.items;
}

async function requestAndConsent(predictor: Client, target: Client, scope: "PRIVATE" | "SHARED" = "SHARED") {
  const invite = await predictor.post<{ invitationId: string; targetId: string }>("/api/v1/radar/invitations", { email: target.email });
  check(`${predictor.label} → ${target.label}: pedido por e-mail`, invite.status === 201 && invite.data.targetId === target.userId, invite);
  const accept = await target.post<{ acceptanceId: string }>(`/api/v1/radar/invitations/${invite.data.invitationId}/accept`, {});
  check(`${target.label}: aceitou o pedido de ${predictor.label}`, accept.status === 201, accept);
  const notice = await target.get<{ presentationId: string; version: string; contentHash: string }>(`/api/v1/consent-notice?purpose=BE_PREDICTED&acceptanceId=${accept.data.acceptanceId}`);
  check(`${target.label}: aviso de previsão apresentado`, notice.status === 200, notice);
  const grant = await target.post<{ grantId: string }>("/api/v1/radar/consents", {
    acceptanceId: accept.data.acceptanceId, presentationId: notice.data.presentationId, accepted: true,
    noticeVersion: notice.data.version, noticeHash: notice.data.contentHash, scope,
  });
  check(`${target.label}: consentiu ser prevista por ${predictor.label}`, grant.status === 201, grant);
  // Predictions only cover answers given after consent: the target re-confirms.
  const reconfirm = await target.post<{ confirmed: number }>("/api/v1/radar/answers/reconfirm", {});
  check(`${target.label}: reconfirmou o gabarito`, reconfirm.status === 201 && reconfirm.data.confirmed === 12, reconfirm);
  return grant.data.grantId;
}

async function predictAll(predictor: Client, targetId: string, questions: Question[], skill: number) {
  const opportunities = await predictor.get<{ items: { targetId: string; grantId: string; questionVersionId: string; selfAnswerVersionId: string }[] }>("/api/v1/radar/opportunities");
  const mine = opportunities.data.items?.filter((item) => item.targetId === targetId) ?? [];
  check(`${predictor.label}: 12 oportunidades de previsão`, mine.length === 12, opportunities.data);
  let sent = 0;
  for (const [index, item] of mine.entries()) {
    const question = questions.find((q) => q.questionVersionId === item.questionVersionId)!;
    const n = question.options.length;
    // Deterministic "knowledge": the predictor leans on a guessed option.
    const guess = (index * 7 + skill) % n;
    const vector = Array.from({ length: n }, (_, i) => (i === guess ? 0.55 : 0.45 / (n - 1)));
    const result = await predictor.post("/api/v1/radar/predictions", {
      targetId: item.targetId, questionVersionId: item.questionVersionId, selfAnswerVersionId: item.selfAnswerVersionId,
      grantId: item.grantId, probabilityVector: vector,
    });
    if (result.status === 201) sent += 1; else check(`${predictor.label}: previsão ${index + 1}`, false, result);
  }
  check(`${predictor.label}: enviou 12 previsões`, sent === 12, { sent });
}

async function main() {
  console.log(`\nORVOK · simulação ${run} em ${BASE}\n`);
  const health = await fetch(BASE + "/api/health").then((r) => r.status).catch(() => 0);
  check("servidor responde /api/health", health === 200, { health });

  const anonymous = new Client("anon", "none");
  const denied = await anonymous.get("/api/v1/radar/dashboard");
  check("anônimo não acessa a API operacional (401)", denied.status === 401, denied);

  const ana = await signUp("ana", "Ana Ribeiro", "Designer, curiosa sobre como os amigos me enxergam.");
  const bruno = await signUp("bruno", "Bruno Tavares", "Engenheiro. Acha que conhece todo mundo.");
  const carla = await signUp("carla", "Carla Nunes", "Professora de física e colecionadora de previsões.");
  const dani = await signUp("dani", "Dani Prado", "Chegou agora.");

  const badLogin = await new Client("x", ana.email).post("/api/v1/auth/login", { email: ana.email, password: "Errada#123" });
  check("senha errada é recusada (401)", badLogin.status === 401, badLogin);

  const questions = await answerAll(ana, (i) => (i * 3) % 4);
  await answerAll(carla, (i) => (i + 1) % 4);
  await answerAll(bruno, (i) => (i * 3 + 1) % 4);

  const selfInvite = await ana.post("/api/v1/radar/invitations", { email: ana.email });
  check("não é possível pedir para prever a si mesmo", selfInvite.status >= 400, selfInvite);
  const ghost = await ana.post("/api/v1/radar/invitations", { email: `ninguem.${run}@orvok.test` });
  check("e-mail sem conta retorna 404", ghost.status === 404, ghost);

  await requestAndConsent(bruno, ana);
  const carlaGrant = await requestAndConsent(carla, ana);
  await requestAndConsent(ana, carla, "PRIVATE");

  const early = await dani.get<{ items: unknown[] }>("/api/v1/radar/opportunities");
  check("sem consentimento não há oportunidades", early.status === 200 && early.data.items.length === 0, early);

  await predictAll(bruno, ana.userId, questions, 0);
  await predictAll(carla, ana.userId, questions, 3);
  await predictAll(ana, carla.userId, questions, 1);

  const encounter = await ana.get<{ received: { predictorId: string }[]; answers: unknown[]; questions: unknown[] }>("/api/v1/radar/encounter");
  const predictors = new Set(encounter.data.received?.map((item) => item.predictorId));
  check("Ana vê o encontro: 24 previsões de 2 pessoas", encounter.data.received?.length === 24 && predictors.size === 2, { n: encounter.data.received?.length, p: predictors.size });
  check("encontro traz as 12 respostas da Ana", encounter.data.answers?.length === 12, encounter.data.answers?.length);

  const carlaView = await carla.get<{ received: unknown[] }>("/api/v1/radar/encounter");
  check("escopo PRIVADO: Carla não vê o que a Ana previu sobre ela", carlaView.data.received?.length === 0, carlaView.data.received?.length);
  const brunoView = await bruno.get<{ received: unknown[] }>("/api/v1/radar/encounter");
  check("Bruno não enxerga previsões feitas sobre a Ana", brunoView.data.received?.length === 0, brunoView.data);

  const dash = await ana.get<{ made: unknown[]; received: { id: string }[]; matches: unknown[] }>("/api/v1/radar/dashboard");
  check("painel da Ana: previsões recebidas", dash.data.received?.length > 0, dash.data);
  check("reciprocidade Ana ↔ Carla detectada", dash.data.matches?.length === 1, dash.data.matches);
  const snapshotId = dash.data.received[0]!.id;
  const foreign = await dani.get(`/api/v1/radar/snapshots/${snapshotId}`);
  check("Dani não abre snapshot alheio (404)", foreign.status === 404, foreign);

  const people = await ana.get<{ items: { displayName: string }[] }>(`/api/v1/people?ids=${bruno.userId},${carla.userId}`);
  check("diretório devolve nomes", people.data.items?.length === 2, people.data);

  // World
  const admin = new Client("admin", ADMIN_EMAIL);
  const adminLogin = await admin.post<{ userId: string }>("/api/v1/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  check("admin: login", adminLogin.status === 200, adminLogin);
  const now = Date.now();
  const worldSeeds = [
    { category: "economia", title: `Selic termina 2026 abaixo de 14%? (${run})`, a: "Sim", b: "Não", days: 20 },
    { category: "ciencia", title: `Missão Artemis III lança antes de 2027? (${run})`, a: "Sim", b: "Não", days: 45 },
    { category: "tecnologia", title: `Real digital (Drex) abre ao público em 2026? (${run})`, a: "Sim", b: "Não", days: 30 },
  ];
  const eventIds: string[] = [];
  for (const seed of worldSeeds) {
    const created = await admin.post<{ id: string }>("/api/v1/world/events", {
      category: seed.category, title: seed.title, resolutionCriteria: "Resolvido pela fonte oficial citada no encerramento.",
      opensAt: new Date(now - 60_000).toISOString(), closesAt: new Date(now + seed.days * 86_400_000).toISOString(),
      opportunities: [{ code: "A", label: seed.a }, { code: "B", label: seed.b }], reason: "Simulação ponta a ponta",
    });
    check(`admin: rascunho "${seed.category}"`, created.status === 201, created);
    const published = await admin.post(`/api/v1/admin/events/${created.data.id}/publish`, { reason: "Revisado na simulação" });
    check(`admin: publicou "${seed.category}"`, published.status === 200, published);
    eventIds.push(created.data.id);
  }
  const forbiddenDraft = await bruno.post("/api/v1/world/events", {
    category: "x", title: "x", resolutionCriteria: "x", opensAt: new Date().toISOString(), closesAt: new Date(now + 86_400_000).toISOString(),
    opportunities: [{ code: "A", label: "a" }, { code: "B", label: "b" }], reason: "x",
  });
  check("usuário comum não cria evento (403)", forbiddenDraft.status === 403, forbiddenDraft);

  const events = await ana.get<{ items: { id: string; opportunities: { id: string }[] }[] }>("/api/v1/world/events");
  const visible = events.data.items?.filter((item) => eventIds.includes(item.id)) ?? [];
  check("eventos publicados visíveis para usuários", visible.length === 3, events.data);
  for (const [index, person] of [ana, bruno, carla].entries()) {
    for (const [j, event] of visible.entries()) {
      const option = event.opportunities[(index + j) % 2]!;
      const p = await person.post(`/api/v1/world/events/${event.id}`, { opportunityId: option.id, confidence: 0.55 + 0.1 * ((index + j) % 4) });
      if (p.status !== 201) check(`${person.label}: previsão no mundo`, false, p);
    }
  }
  const mine = await carla.get<{ items: unknown[] }>("/api/v1/world/predictions");
  check("Carla vê suas 3 previsões do mundo", mine.data.items?.length >= 3, mine.data);
  const comment = await bruno.post(`/api/v1/world/events/${visible[0]!.id}/comments`, { body: "O último Copom mudou meu palpite." });
  check("comentário em evento do mundo", comment.status === 201, comment);

  // Social
  const post = await carla.post<{ id: string }>("/api/v1/social/posts", { body: "Acertei 8 de 12 sobre a Ana. Ela me surpreendeu nas manhãs." });
  check("post no feed", post.status === 201, post);
  await ana.post(`/api/v1/social/posts/${post.data.id}/reactions`, { kind: "insight" });
  const reply = await ana.post(`/api/v1/social/posts/${post.data.id}/comments`, { body: "As manhãs são meu segredo." });
  check("comentário no post", reply.status === 201, reply);
  const feed = await bruno.get<{ items: { id: string; reactionCount: number; commentCount: number }[] }>("/api/v1/social/feed");
  const inFeed = feed.data.items?.find((item) => item.id === post.data.id);
  check("feed agrega reações e comentários", inFeed?.reactionCount === 1 && inFeed.commentCount === 1, inFeed);
  const group = await ana.post<{ id: string }>("/api/v1/social/groups", { name: "Turma do café", description: "Previsões entre amigos de longa data." });
  check("grupo criado", group.status === 201, group);
  const gInvite = await ana.post<{ id: string }>(`/api/v1/social/groups/${group.data.id}/invites`, { inviteeId: bruno.userId });
  check("convite para grupo", gInvite.status === 201, gInvite);
  const pending = await bruno.get<{ items: { id: string }[] }>("/api/v1/social/group-invites");
  check("Bruno vê convite pendente", pending.data.items?.some((i) => i.id === gInvite.data.id), pending.data);
  const joined = await bruno.post(`/api/v1/social/group-invites/${gInvite.data.id}/accept`, {});
  check("Bruno entrou no grupo", joined.status === 200, joined);
  const groups = await bruno.get<{ items: unknown[] }>("/api/v1/social/groups");
  check("grupo aparece para o Bruno", groups.data.items?.length === 1, groups.data);
  const danaGroups = await dani.get<{ items: unknown[] }>("/api/v1/social/groups");
  check("Dani não vê o grupo privado", danaGroups.data.items?.length === 0, danaGroups.data);

  const notes = await ana.get<{ items: unknown[] }>("/api/v1/notifications");
  check("notificações da Ana carregam", notes.status === 200, notes);

  // Admin
  const users = await admin.get<{ items: { id: string }[] }>("/api/v1/admin/users");
  check("admin lista usuários (mais que a própria conta)", users.data.items?.length >= 5, users.data);
  const metrics = await admin.get<{ metrics: Record<string, number> }>("/api/v1/admin/metrics");
  check("admin lê métricas", metrics.status === 200, metrics);
  const blocked = await bruno.get("/api/v1/admin/metrics");
  check("usuário comum não lê métricas (403)", blocked.status === 403, blocked);
  const suspend = await admin.post(`/api/v1/admin/users/${dani.userId}/action`, { action: "SUSPEND", reason: "Teste de moderação" });
  check("admin suspende conta", suspend.status === 200, suspend);
  const daniAfter = await dani.get("/api/v1/radar/dashboard");
  check("conta suspensa perde acesso", daniAfter.status === 401 || daniAfter.status === 403, daniAfter);
  const unsuspend = await admin.post(`/api/v1/admin/users/${dani.userId}/action`, { action: "UNSUSPEND", reason: "Fim do teste" });
  check("admin reativa conta", unsuspend.status === 200, unsuspend);

  // Revocation last, so the demo keeps Bruno's predictions.
  const revoke = await ana.post(`/api/v1/radar/consents/${carlaGrant}/revoke`, {});
  check("Ana revoga o consentimento dado à Carla", revoke.status === 201, revoke);
  const after = await ana.get<{ received: { predictorId: string }[] }>("/api/v1/radar/encounter");
  check("após revogar, previsões da Carla somem do encontro", after.data.received?.every((item) => item.predictorId !== carla.userId), after.data.received?.length);

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
  console.log(`Contas criadas (senha ${PASSWORD}): ${[ana, bruno, carla, dani].map((c) => c.email).join(", ")}`);
  if (failed.length) process.exitCode = 1;
}

await main();

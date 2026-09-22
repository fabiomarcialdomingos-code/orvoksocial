"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

type Question = {
  questionVersionId: string;
  version: number | string;
  text: string;
  instrumentVersion: string;
  catalogStatus: "TEST_ONLY";
  options: { id: string; label: string; position: number }[];
};
type Answer = {
  id: string;
  questionVersionId: string;
  optionId: string;
  version: number;
  answeredAt: string;
};
type Opportunity = {
  targetId: string;
  grantId: string;
  questionVersionId?: string;
  selfAnswerVersionId?: string;
};
function opportunityKey(item: Opportunity) {
  return `${item.targetId}:${item.grantId}:${item.questionVersionId ?? "all"}`;
}
type Prediction = {
  id: string;
  predictorId?: string;
  targetId?: string;
  questionVersionId: string;
  predictedAt: string;
};
type Invitation = { id: string; predictorId: string; invitedAt: string; expiresAt?: string | null };
type Match = { userId: string; mutualAt: string };
type Dashboard = {
  made: Prediction[];
  received: Prediction[];
  pendingInvitations: Invitation[];
  matches: Match[];
  hasMore?: { made: boolean; received: boolean; pendingInvitations: boolean; matches: boolean };
};
type Notification = { id: string; eventType: string; state: string; createdAt: string };
type Notice = { version: string; content: string; contentHash: string; presentationId: string };
type ViewState = "loading" | "ready" | "error";
type Feedback = { kind: "success" | "error"; text: string };

const emptyDashboard: Dashboard = { made: [], received: [], pendingInvitations: [], matches: [] };

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", signal: signal ?? null, cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401 ? "Faça login para acessar o Radar." : "Não foi possível carregar os dados. Tente novamente.");
  return (await response.json()) as T;
}

async function getPaged<T>(url: string, signal?: AbortSignal): Promise<{ items: T[] }> {
  const items: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const data: { items: T[]; nextCursor?: string | null } = await getJson(`${url}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, signal);
    items.push(...data.items);
    if (!data.nextCursor) return { items };
    cursor = data.nextCursor;
  }
  throw new Error("A lista excede o limite de leitura da interface.");
}

async function postJson<T>(url: string, data: object, idempotencyKey = crypto.randomUUID()): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(response.status === 429
      ? "Muitas tentativas. Aguarde antes de tentar novamente."
      : response.status === 409
        ? "A operação não está mais disponível. Atualize os dados e tente novamente."
        : "Não foi possível concluir. Confira as condições de consentimento e tente novamente.");
  }
  return (await response.json()) as T;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="radar-empty" role="status">{children}</p>;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Data indisponível" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

export function RadarWorkspace() {
  const [state, setState] = useState<ViewState>("loading");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationBusyId, setNotificationBusyId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [noticeState, setNoticeState] = useState<ViewState>("loading");
  const [selfGrantId, setSelfGrantId] = useState("");
  const [ownSelectedQuestion, setOwnSelectedQuestion] = useState("");
  const [confirmNotice, setConfirmNotice] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState("");
  const [percentages, setPercentages] = useState<number[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [snapshotId, setSnapshotId] = useState("");
  const [snapshotConfirmed, setSnapshotConfirmed] = useState(false);
  const [snapshotDetail, setSnapshotDetail] = useState<{ predictedAt: string; consentVersion: number; snapshotHash?: string } | null>(null);
  const predictionAttempt = useRef<{ body: string; key: string } | null>(null);
  const notificationAttempts = useRef(new Map<string, string>());
  const submitLock = useRef(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const [catalog, own, panel, alerts, available, grants] = await Promise.all([
        getJson<{ items: Question[] }>("/api/v1/radar/questions", signal),
        getPaged<Answer>("/api/v1/radar/answers", signal),
        getJson<Dashboard>("/api/v1/radar/dashboard", signal),
        getPaged<Notification>("/api/v1/notifications", signal),
        getJson<{ items: Opportunity[] }>("/api/v1/radar/opportunities", signal),
        getPaged<{ id: string; purpose: string; revokedAt: string | null }>("/api/v1/radar/consents", signal),
      ]);
      if (signal?.aborted) return;
      setQuestions(catalog.items.filter((item) => item.catalogStatus === "TEST_ONLY"));
      setAnswers(own.items);
      setDashboard(panel);
      setNotifications(alerts.items);
      setOpportunities(available.items);
      setSelfGrantId(grants.items.find((item) => item.purpose === "SELF_ANSWER" && !item.revokedAt)?.id ?? "");
      setState("ready");
    } catch {
      if (!signal?.aborted) setState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void refresh(controller.signal); });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (state !== "ready" || questions.length === 0 || selfGrantId) return;
    const controller = new AbortController();
    getJson<Notice>("/api/v1/consent-notice?purpose=SELF_ANSWER", controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        if (!value.content || !value.version || !value.presentationId || !/^[a-f0-9]{64}$/i.test(value.contentHash)) throw new Error("INVALID_NOTICE");
        setNotice(value);
        setNoticeState("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setNoticeState("error"); });
    return () => controller.abort();
  }, [state, questions.length, selfGrantId]);

  const question = questions.find((item) => item.questionVersionId === selectedQuestion);
  const opportunity = opportunities.find((item) => opportunityKey(item) === selectedOpportunity);
  const ownAnswer = answers.filter((item) => item.questionVersionId === selectedQuestion).sort((a, b) => b.version - a.version)[0];
  const percentageSum = percentages.reduce((sum, value) => sum + value, 0);

  async function submitOwnConsent() {
    if (!notice || !confirmNotice) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await postJson<{ grantId: string }>("/api/v1/radar/self-answer-consents", {
        presentationId: notice.presentationId,
        accepted: true,
        noticeVersion: notice.version,
        noticeHash: notice.contentHash,
      });
      setSelfGrantId(result.grantId);
      setFeedback({ kind: "success", text: "Consentimento para respostas próprias registrado. Guarde a confirmação para esta sessão." });
    } catch (error) {
      setFeedback({ kind: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const questionVersionId = String(form.get("questionVersionId") ?? "");
    const optionId = String(form.get("optionId") ?? "");
    if (!selfGrantId || !questionVersionId || !optionId) return;
    setBusy(true);
    setFeedback(null);
    try {
    const prior = answers.filter((item) => item.questionVersionId === questionVersionId).sort((a, b) => b.version - a.version)[0];
      await postJson("/api/v1/radar/answers", {
        questionVersionId,
        optionId,
        consentGrantId: selfGrantId,
        ...(prior ? { supersedesId: prior.id } : {}),
      });
      setFeedback({ kind: "success", text: "Resposta própria registrada em nova versão imutável." });
      await refresh();
    } catch (error) {
      setFeedback({ kind: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function submitPrediction() {
    if (!question || !opportunity || !ownAnswer || Math.abs(percentageSum - 100) > 0.001 || percentages.length !== question.options.length) return;
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setFeedback(null);
    const body = {
      targetId: opportunity.targetId,
      questionVersionId: question.questionVersionId,
      selfAnswerVersionId: opportunity.selfAnswerVersionId ?? ownAnswer.id,
      grantId: opportunity.grantId,
      probabilityVector: percentages.map((value) => value / 100),
    };
    const bodyText = JSON.stringify(body);
    const attempt = predictionAttempt.current?.body === bodyText
      ? predictionAttempt.current
      : { body: bodyText, key: crypto.randomUUID() };
    predictionAttempt.current = attempt;
    try {
      const result = await postJson<{ snapshotId: string; consentVersion?: number }>("/api/v1/radar/predictions", body, attempt.key);
      predictionAttempt.current = null;
      setSnapshotId(result.snapshotId);
      setReviewing(false);
      setFeedback({ kind: "success", text: "Previsão enviada e snapshot gravado sem possibilidade de edição." });
      try {
        const saved = await getJson<{ snapshot: { id: string; predictedAt: string; consentVersion: number; snapshotHash: string } }>(`/api/v1/radar/snapshots/${encodeURIComponent(result.snapshotId)}`);
        setSnapshotConfirmed(saved.snapshot.id === result.snapshotId);
        setSnapshotDetail({ predictedAt: saved.snapshot.predictedAt, consentVersion: saved.snapshot.consentVersion, snapshotHash: saved.snapshot.snapshotHash });
      } catch {
        setSnapshotConfirmed(false);
        setSnapshotDetail(result.consentVersion ? { predictedAt: "", consentVersion: result.consentVersion } : null);
      }
      await refresh().catch(() => {});
    } catch (error) {
      setFeedback({ kind: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  }

  async function changeNotification(id: string, action: "read" | "dismiss") {
    if (notificationBusyId) return;
    const attempt = `${id}:${action}`;
    const key = notificationAttempts.current.get(attempt) ?? crypto.randomUUID();
    notificationAttempts.current.set(attempt, key);
    setNotificationBusyId(id);
    setFeedback(null);
    try {
      const result = await postJson<{ state: string }>(`/api/v1/notifications/${encodeURIComponent(id)}/${action}`, {}, key);
      notificationAttempts.current.delete(attempt);
      setNotifications((items) => items.map((item) => item.id === id ? { ...item, state: result.state } : item));
      setFeedback({ kind: "success", text: action === "read" ? "Notificação marcada como lida." : "Notificação dispensada." });
    } catch (error) {
      setFeedback({ kind: "error", text: (error as Error).message });
    } finally {
      setNotificationBusyId("");
    }
  }

  return (
    <div className="radar-workspace">
      <p className="radar-test-banner" role="status"><strong>TEST_ONLY</strong> · Este catálogo usa somente fixtures de teste. Nenhuma pergunta oficial foi publicada.</p>
      <nav aria-label="Seções do Radar" className="radar-sections">
        <a href="#painel">Painel</a><a href="#responder">Responder</a><a href="#prever">Prever</a><a href="#notificacoes">Notificações</a><a href="#meus-dados">Meus dados</a>
      </nav>
      {feedback && <p className="form-message" data-kind={feedback.kind} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.text}</p>}
      {state === "loading" && <p role="status">Carregando Radar…</p>}
      {state === "error" && <div role="alert" className="radar-empty"><p>Não foi possível carregar o Radar. Faça login ou tente novamente.</p><button type="button" className="button button-secondary" onClick={() => { setState("loading"); void refresh(); }}>Tentar novamente</button></div>}
      {state === "ready" && <>
        <section id="painel" className="radar-section" aria-labelledby="painel-titulo">
          <h2 id="painel-titulo" className="display">Seu painel</h2>
          <div className="radar-grid">
            <div className="radar-panel"><h3>Previsões feitas</h3>{dashboard.made.length ? <ul>{dashboard.made.map((item) => <li key={item.id}>Sobre {item.targetId} · {dateLabel(item.predictedAt)}<br /><Link href={`/radar/snapshots/${item.id}`}>Ver confirmação</Link></li>)}</ul> : <Empty>Nenhuma previsão registrada.</Empty>}{dashboard.hasMore?.made && <p>Exibindo as 20 mais recentes.</p>}</div>
            <div className="radar-panel"><h3>Previsões sobre você</h3>{dashboard.received.length ? <ul>{dashboard.received.map((item) => <li key={item.id}>De {item.predictorId} · {dateLabel(item.predictedAt)}<br /><Link href={`/radar/snapshots/${item.id}`}>Ver dados autorizados</Link></li>)}</ul> : <Empty>Nenhuma previsão disponível para você.</Empty>}{dashboard.hasMore?.received && <p>Exibindo as 20 mais recentes.</p>}</div>
            <div className="radar-panel"><h3>Convites pendentes</h3>{dashboard.pendingInvitations.length ? <ul>{dashboard.pendingInvitations.map((item) => <li key={item.id}>De {item.predictorId} · {dateLabel(item.invitedAt)}{item.expiresAt && <> · vence {dateLabel(item.expiresAt)}</>}<br /><Link href={`/aceitar-convite?convite=${encodeURIComponent(item.id)}`}>Analisar convite</Link></li>)}</ul> : <Empty>Nenhum convite pendente.</Empty>}{dashboard.hasMore?.pendingInvitations && <p>Exibindo os 20 mais recentes.</p>}</div>
            <div className="radar-panel"><h3>Reciprocidade de teste</h3>{dashboard.matches.length ? <ul>{dashboard.matches.map((item) => <li key={item.userId}>Convites e consentimentos ativos nos dois sentidos com {item.userId} · {dateLabel(item.mutualAt)}</li>)}</ul> : <Empty>Nenhuma relação recíproca de teste ativa. Isto não representa match de afinidade.</Empty>}{dashboard.hasMore?.matches && <p>Exibindo as 20 relações mais recentes.</p>}</div>
          </div>
          <div className="form-actions"><Link className="button button-secondary" href="/convites">Convidar</Link><Link className="text-link" href="/aceitar-convite">Ver convites</Link><Link className="text-link" href="/consentimento">Gerir consentimento</Link></div>
        </section>
        <section id="responder" className="radar-section" aria-labelledby="responder-titulo">
          <h2 id="responder-titulo" className="display">Suas respostas</h2>
          {!questions.length ? <Empty>O catálogo de teste está vazio. Perguntas oficiais aguardam aprovação.</Empty> : <>
            <p>Respostas próprias exigem aviso e consentimento separados dos convites.</p>
            {noticeState === "loading" && <p role="status">Carregando aviso…</p>}
            {noticeState === "error" && <Empty>O aviso não está disponível. Responder permanece bloqueado.</Empty>}
            {notice && !selfGrantId && <div className="radar-panel"><h3>Aviso de respostas próprias · versão {notice.version}</h3><div className="notice" tabIndex={0}>{notice.content}</div><label className="checkbox-row"><input type="checkbox" checked={confirmNotice} onChange={(event) => setConfirmNotice(event.target.checked)} />Li o aviso acima e consinto, separadamente, em registrar minhas respostas.</label><button type="button" className="button" disabled={!confirmNotice || busy} onClick={() => void submitOwnConsent()}>{busy ? "Aguarde…" : "Confirmar consentimento"}</button></div>}
            {selfGrantId && <form className="form-stack" onSubmit={(event) => void submitAnswer(event)}><div className="field"><label htmlFor="own-question">Pergunta de teste</label><select id="own-question" name="questionVersionId" required value={ownSelectedQuestion} onChange={(event) => setOwnSelectedQuestion(event.target.value)}><option value="" disabled>Selecione</option>{questions.map((item) => <option key={item.questionVersionId} value={item.questionVersionId}>{item.text} · TEST_ONLY</option>)}</select></div><div className="field"><label htmlFor="own-option">Sua resposta</label><select id="own-option" name="optionId" required key={ownSelectedQuestion} defaultValue=""><option value="" disabled>Selecione uma opção</option>{questions.find((item) => item.questionVersionId === ownSelectedQuestion)?.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div><button type="submit" className="button" disabled={busy || !ownSelectedQuestion}>Registrar versão da resposta</button></form>}
            <h3>Respostas registradas</h3>{answers.length ? <ul className="radar-list">{answers.map((item) => <li key={item.id}>Pergunta {questions.find((q) => q.questionVersionId === item.questionVersionId)?.text ?? item.questionVersionId} · versão {item.version} · {dateLabel(item.answeredAt)}</li>)}</ul> : <Empty>Você ainda não respondeu às perguntas de teste.</Empty>}
          </>}
        </section>
        <section id="prever" className="radar-section" aria-labelledby="prever-titulo">
          <h2 id="prever-titulo" className="display">Fazer previsão</h2>
          <p>A previsão exige convite aceito, consentimento ativo do alvo e gabarito anterior. Não há cálculo de pontuação nesta etapa.</p>
          {!opportunities.length || !questions.length ? <Empty>Nenhuma relação elegível ou pergunta de teste disponível.</Empty> : <div className="form-stack">
            <div className="field"><label htmlFor="prediction-target">Relação elegível</label><select id="prediction-target" value={selectedOpportunity} onChange={(event) => { setSelectedOpportunity(event.target.value); setSelectedQuestion(""); setPercentages([]); setReviewing(false); predictionAttempt.current = null; }}><option value="">Selecione</option>{opportunities.map((item) => <option key={opportunityKey(item)} value={opportunityKey(item)}>{item.targetId}{item.questionVersionId ? ` · ${questions.find((q) => q.questionVersionId === item.questionVersionId)?.text ?? "Pergunta de teste"}` : ""}</option>)}</select></div>
            <div className="field"><label htmlFor="prediction-question">Pergunta de teste</label><select id="prediction-question" value={selectedQuestion} onChange={(event) => { const next = questions.find((item) => item.questionVersionId === event.target.value); setSelectedQuestion(event.target.value); setPercentages(next?.options.map(() => 0) ?? []); setReviewing(false); }}><option value="">Selecione</option>{questions.filter((item) => !opportunity?.questionVersionId || opportunity.questionVersionId === item.questionVersionId).map((item) => <option key={item.questionVersionId} value={item.questionVersionId}>{item.text}</option>)}</select></div>
            {question && <fieldset className="radar-probabilities"><legend>Distribua 100% entre as opções</legend>{question.options.map((option, index) => <div className="field" key={option.id}><label htmlFor={`probability-${option.id}`}>{option.label}</label><input id={`probability-${option.id}`} type="number" min="0" max="100" step="0.1" inputMode="decimal" value={percentages[index] ?? 0} onChange={(event) => { const next = [...percentages]; next[index] = Number(event.target.value); setPercentages(next); setReviewing(false); }} /></div>)}<p role="status">Total: {percentageSum.toLocaleString("pt-BR")}%. O total deve ser 100%.</p></fieldset>}
            {question && !ownAnswer && <Empty>Responda esta pergunta primeiro para poder prever outra pessoa.</Empty>}
            {!reviewing ? <button type="button" className="button" disabled={!question || !opportunity || !ownAnswer || Math.abs(percentageSum - 100) > 0.001 || busy} onClick={() => setReviewing(true)}>Revisar previsão</button> : <div className="radar-panel"><h3>Confirme antes de gravar</h3><p>Alvo: {opportunity?.targetId}. Pergunta: {question?.text}. Distribuição: {percentages.join("% · ")}%. Após a confirmação, o snapshot não pode ser alterado.</p><div className="form-actions"><button type="button" className="button" disabled={busy} onClick={() => void submitPrediction()}>{busy ? "Gravando…" : "Confirmar previsão"}</button><button type="button" className="button button-secondary" onClick={() => setReviewing(false)} disabled={busy}>Voltar</button></div></div>}
          </div>}
          {snapshotId && <p className="form-message" role="status">Snapshot {snapshotId}: {snapshotConfirmed ? "confirmado e imutável" : "gravado; confirmação de leitura indisponível"}. {snapshotDetail?.predictedAt ? `Registrado em ${new Date(snapshotDetail.predictedAt).toLocaleString("pt-BR")}.` : ""} {snapshotDetail?.consentVersion ? `Consentimento versão ${snapshotDetail.consentVersion}.` : ""} {snapshotDetail?.snapshotHash ? `Hash ${snapshotDetail.snapshotHash}.` : ""}</p>}
        </section>
        <section id="notificacoes" className="radar-section" aria-labelledby="notificacoes-titulo"><h2 id="notificacoes-titulo" className="display">Notificações</h2>{notifications.length ? <ul className="radar-list">{notifications.map((item) => <li key={item.id}>{item.eventType} · {item.state} · {dateLabel(item.createdAt)}{item.state !== "DISMISSED" && <span className="radar-notification-actions">{item.state === "UNREAD" && <button type="button" className="text-link" disabled={!!notificationBusyId} onClick={() => void changeNotification(item.id, "read")}>Marcar como lida</button>}<button type="button" className="text-link" disabled={!!notificationBusyId} onClick={() => void changeNotification(item.id, "dismiss")}>Dispensar</button></span>}</li>)}</ul> : <Empty>Nenhuma notificação no momento.</Empty>}</section>
        <section id="meus-dados" className="radar-section" aria-labelledby="dados-titulo"><h2 id="dados-titulo" className="display">Seus dados</h2><p>Você pode exportar seus dados ou solicitar exclusão. O tratamento da solicitação segue uma política técnica provisória, sujeita a revisão jurídica.</p><Link className="text-link" href="/meus-dados">Gerir dados</Link></section>
      </>}
    </div>
  );
}

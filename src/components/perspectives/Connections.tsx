"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  apiGet,
  apiPost,
  getAll,
  describeError,
  type WorldEvent,
} from "../../lib/client/api";
import {
  INVITE_NOTICE,
  SHARE_NOTICE,
  RELATIONS,
  assess,
  type Connection,
  type Guess,
  type Relationship,
} from "../../lib/perspectives/model";
import { useShell } from "../app/AppShell";
import {
  PageHead,
  useResource,
  Loading,
  ErrorState,
  Avatar,
  ConnectionCard,
} from "./Shared";
export function Connections() {
  const r = useResource<{ items: Connection[] }>("/perspectives/connections");
  const [filter, setFilter] = useState("all");
  const list = r.data?.items.filter(
    (c) =>
      filter === "all" ||
      (filter === "world" && c.kind === "world") ||
      (filter === "completed" && c.state === "completed") ||
      (filter === "pending" && ["pending", "accepted"].includes(c.state)),
  );
  return (
    <>
      <PageHead
        kicker="02 / Conexões"
        title="Toda pessoa é outra perspectiva."
        text="O crush, um amigo de anos, alguém da família. Descubra o que cada pessoa percebe em você."
        action={
          <Link className="button" href="/sobre-mim">
            Convidar alguém ↗
          </Link>
        }
      />
      <div className="filter-bar">
        {[
          ["all", "Todas"],
          ["pending", "Em andamento"],
          ["completed", "Descobertas"],
          ["world", "Prever juntos"],
        ].map(([id, label]) => (
          <button
            className="chip"
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id!)}
          >
            {label}
          </button>
        ))}
        <button className="text-link" onClick={() => void r.reload()}>
          Atualizar ↻
        </button>
      </div>
      {r.error ? (
        <ErrorState message={r.error} retry={() => void r.reload()} />
      ) : !r.data ? (
        <Loading />
      ) : list?.length ? (
        <div className="connection-grid">
          {list.map((c) => (
            <ConnectionCard connection={c} key={c.id} />
          ))}
        </div>
      ) : (
        <div className="empty illustrated-empty">
          <span className="empty-mark">↔</span>
          <h2>
            {r.data.items.length
              ? "Nenhuma conexão neste filtro."
              : "Quem você gostaria de encontrar aqui?"}
          </h2>
          <p>Responda uma rodada sobre você e prepare um convite individual.</p>
          <Link className="button" href="/sobre-mim">
            Começar por mim ↗
          </Link>
        </div>
      )}
    </>
  );
}
export function TogetherInvite({ eventId }: { eventId: string }) {
  const { toast } = useShell();
  const [relation, setRelation] = useState<Relationship>("geral"),
    [agree, setAgree] = useState(false),
    [busy, setBusy] = useState(false),
    [url, setUrl] = useState("");
  return (
    <section className="together-invite">
      <span className="eyebrow">Mundo + pessoas</span>
      <h3>Quem adivinharia sua previsão?</h3>
      <p>
        Convide alguém para prever sua escolha e dar o próprio palpite. Vocês
        podem pensar diferente e se entender bem.
      </p>
      <label className="field">
        <span>Quem você quer convidar? Só você vê.</span>
        <select
          value={relation}
          onChange={(e) => setRelation(e.target.value as Relationship)}
        >
          {Object.entries(RELATIONS).map(([id, label]) => (
            <option value={id} key={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
        />
        <span>{SHARE_NOTICE}</span>
      </label>
      <button
        className="button"
        disabled={!agree || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await apiPost<{ connection: Connection }>(
              "/perspectives/connections",
              {
                kind: "world",
                eventId,
                relationship: relation,
                accepted: true,
              },
            );
            setUrl(`${location.origin}/juntos/${r.connection.code}`);
          } catch (e) {
            toast(describeError(e), "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparando…" : "Criar convite para prever juntos ↗"}
      </button>
      {url && (
        <div className="share-result">
          <input
            aria-label="Link para prever juntos"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
          />
          <div className="row wrap">
            <button
              className="text-link"
              onClick={() =>
                void navigator.clipboard
                  .writeText(url)
                  .then(() => toast("Convite copiado."))
                  .catch(() => toast("Selecione e copie o link.", "error"))
              }
            >
              Copiar convite
            </button>
            <Link className="text-link" href={url}>
              Acompanhar →
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
export function ConnectionDetail({ code }: { code: string }) {
  const { toast, session } = useShell(),
    r = useResource<{ connection: Connection }>(
      `/perspectives/connections/${code}`,
    );
  const [agree, setAgree] = useState(false),
    [busy, setBusy] = useState(false),
    [guesses, setGuesses] = useState<Record<string, Guess>>({}),
    [step, setStep] = useState(0),
    [message, setMessage] = useState(""),
    [ending, setEnding] = useState(false);
  const [event, setEvent] = useState<WorldEvent | null>(null),
    [worldError, setWorldError] = useState<string | null>(null),
    [own, setOwn] = useState(""),
    [confidence, setConfidence] = useState(0.65);
  const c = r.data?.connection;
  useEffect(() => {
    if (c?.kind !== "world" || !c.eventId || c.state === "completed") return;
    let active = true;
    void Promise.all([
      getAll<WorldEvent>("/world/events"),
      apiGet<{
        items: { eventId: string; opportunityId: string; confidence: number }[];
      }>("/world/predictions"),
    ])
      .then(([events, mine]) => {
        if (!active) return;
        const found = events.find((e) => e.id === c.eventId);
        setEvent(found ?? null);
        if (!found) setWorldError("Este acontecimento não está disponível.");
        const p = mine.items.find((p) => p.eventId === c.eventId);
        if (p) {
          setOwn(p.opportunityId);
          setConfidence(Number(p.confidence));
        }
      })
      .catch((e) => setWorldError(describeError(e)));
    return () => {
      active = false;
    };
  }, [c?.eventId, c?.kind, c?.state]);
  async function act(action: string, data: unknown) {
    setBusy(true);
    try {
      const out = await apiPost<{ connection: Connection }>(
        `/perspectives/connections/${code}/${action}`,
        data,
      );
      r.setData(out);
      return true;
    } catch (e) {
      toast(describeError(e), "error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (r.error)
    return <ErrorState message={r.error} retry={() => void r.reload()} />;
  if (!c) return <Loading />;
  if (c.needsAcceptance)
    return (
      <div className="invitation-landing">
        <span className="eyebrow">Um convite individual</span>
        <h1>
          {c.ownerName} quer saber
          <br />
          como você vê as coisas.
        </h1>
        <p>
          {c.kind === "world"
            ? "Tente antecipar a previsão dessa pessoa e registre a sua. Só então vocês descobrem as perspectivas."
            : "Tente antecipar as escolhas dessa pessoa. As respostas ficam escondidas até você confirmar a rodada inteira."}
        </p>
        <section className="paper-panel">
          <h2>{c.title}</h2>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <span>{INVITE_NOTICE}</span>
          </label>
          <button
            className="button"
            disabled={!agree || busy}
            onClick={() => void act("accept", { accepted: true })}
          >
            Aceitar e começar ↗
          </button>
        </section>
      </div>
    );
  const closed = ["revoked", "expired"].includes(c.state),
    result = assess(c.questions ?? [], c.answers ?? {}, c.guesses ?? {}),
    label = (id?: string | null) =>
      c.worldOptions?.find((o) => o.id === id)?.label ?? "—";
  const wg = c.guesses?.world?.optionId,
    wa = c.answers?.world;
  return (
    <>
      <PageHead
        kicker={c.kind === "world" ? "Prever juntos" : "Como me veem"}
        title={
          c.isOwner ? (c.guestName ?? "Seu próximo encontro") : c.ownerName
        }
        text={c.title}
        action={
          <Link className="text-link" href="/conexoes">
            ← Conexões
          </Link>
        }
      />
      {closed ? (
        <div className="empty">
          <h2>
            {c.state === "revoked"
              ? "Esta conexão foi encerrada."
              : "Este convite não está mais disponível."}
          </h2>
          <p>As respostas e a conversa estão ocultas.</p>
          <Link href="/sobre-mim" className="button">
            Criar uma nova rodada
          </Link>
        </div>
      ) : c.state === "completed" ? (
        <>
          <section className="result-hero">
            <span className="eyebrow">Duas perspectivas. Uma descoberta.</span>
            <h2>
              {c.kind === "world"
                ? wg === wa
                  ? "Uma leitura certeira."
                  : "Uma escolha que surpreendeu."
                : result.total
                  ? `${result.hits} de ${result.total} escolhas novas antecipadas.`
                  : "Uma conversa para revisitar."}
            </h2>
            <p>
              {c.kind === "world"
                ? wa === c.ownWorldChoice
                  ? "Vocês fizeram a mesma previsão sobre o acontecimento."
                  : "Vocês pensaram diferente sobre o acontecimento. Isso não diz quanto gostam um do outro."
                : "O resultado vale para estas perguntas, nesta rodada. Respostas já reveladas ficam fora da contagem. Não é uma nota de personalidade ou compatibilidade."}
            </p>
          </section>
          {c.kind === "world" ? (
            <>
              <div className="comparison-grid">
                <article>
                  <span>O que esperava de {c.ownerName}</span>
                  <h3>{label(wg)}</h3>
                </article>
                <article>
                  <span>A previsão de {c.ownerName}</span>
                  <h3>{label(wa)}</h3>
                </article>
                <article>
                  <span>A previsão de {c.guestName}</span>
                  <h3>{label(c.ownWorldChoice)}</h3>
                </article>
              </div>
              <section className="paper-panel">
                <span className="eyebrow">O acontecimento</span>
                <h3>
                  {c.resolution?.state === "OFFICIAL"
                    ? `Resultado oficial: ${label(c.resolution.outcomeOpportunityId)}`
                    : c.resolution
                      ? c.resolution.state === "TEST"
                        ? "Resultado de teste, sem validade oficial"
                        : c.resolution.state === "CANCELLED"
                          ? "Evento cancelado"
                          : "Evento invalidado"
                      : "A história ainda está acontecendo."}
                </h3>
                <p>
                  {c.resolution?.rationale ??
                    "O entendimento entre vocês já foi comparado. O acerto sobre o mundo depende da resolução do evento."}
                </p>
              </section>
            </>
          ) : (
            <div className="result-rows">
              {result.rows.map((row) => (
                <article key={row.question.id}>
                  <div>
                    <span
                      className={`status ${row.hit ? "completed" : "accepted"}`}
                    >
                      {row.previouslyRevealed
                        ? "Já revelada"
                        : row.hit
                          ? "Entendeu"
                          : "Surpreendeu"}
                    </span>
                    <h3>{row.question.text}</h3>
                  </div>
                  <p>
                    <span>Esperava</span>
                    {
                      row.question.options.find((o) => o.id === row.guess)
                        ?.label
                    }
                  </p>
                  <p>
                    <span>A escolha real</span>
                    {
                      row.question.options.find((o) => o.id === row.answer)
                        ?.label
                    }
                  </p>
                </article>
              ))}
            </div>
          )}
          <section className="conversation-panel">
            <div>
              <span className="eyebrow">Entre vocês</span>
              <h2>
                “O que fez você achar
                <br />
                que eu escolheria isso?”
              </h2>
              <p>Uma descoberta é um bom começo de conversa.</p>
              <Link href="/sobre-mim" className="text-link">
                Agora é minha vez de convidar →
              </Link>
            </div>
            <div className="paper-panel">
              <div className="private-messages">
                {c.messages?.map((m) => (
                  <article
                    key={m.id}
                    className={m.authorId === session.userId ? "mine" : ""}
                  >
                    <strong>
                      {m.authorId === c.ownerId ? c.ownerName : c.guestName}
                    </strong>
                    <p>{m.body}</p>
                  </article>
                ))}
                {!c.messages?.length && (
                  <p>Conversa privada, visível apenas para vocês.</p>
                )}
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await act("message", { body: message })) setMessage("");
                }}
              >
                <label className="field">
                  <span>Sua mensagem</span>
                  <textarea
                    value={message}
                    maxLength={1200}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Essa eu não esperava…"
                  />
                </label>
                <button className="button" disabled={busy || !message.trim()}>
                  Enviar
                </button>
              </form>
            </div>
          </section>
        </>
      ) : c.isOwner ? (
        <section className="waiting-layout">
          <div className="waiting-art">
            <Avatar name={c.ownerName} large />
            <span>↔</span>
            <Avatar name={c.guestName ?? "?"} large />
          </div>
          <h2>
            {c.state === "accepted"
              ? `${c.guestName ?? "A pessoa"} aceitou seu convite.`
              : "Uma nova perspectiva está a um convite de distância."}
          </h2>
          <p>
            {c.state === "accepted"
              ? "Quando ela confirmar a rodada, a descoberta aparece aqui."
              : "Compartilhe o link individual. A relação escolhida fica só com você."}
          </p>
          {c.relationship && (
            <span className="chip">
              Só para você: {RELATIONS[c.relationship]}
            </span>
          )}
          <input
            aria-label="Seu convite"
            readOnly
            value={
              typeof window === "undefined"
                ? ""
                : `${location.origin}/juntos/${code}`
            }
            onFocus={(e) => e.target.select()}
          />
          <div className="row wrap">
            <button
              className="button"
              onClick={() =>
                void navigator.clipboard
                  .writeText(`${location.origin}/juntos/${code}`)
                  .then(() => toast("Link copiado."))
                  .catch(() => toast("Selecione e copie o link.", "error"))
              }
            >
              Copiar convite
            </button>
            <button
              className="button button-secondary"
              onClick={() => void r.reload()}
            >
              Ver se respondeu ↻
            </button>
          </div>
        </section>
      ) : c.kind === "people" ? (
        <section className="guest-quiz">
          {(() => {
            const q = c.questions?.[step];
            if (!q) return null;
            return (
              <>
                <span className="eyebrow">
                  Quanto você conhece {c.ownerName}?
                </span>
                <div className="quiz-progress">
                  {c.questions?.map((q) => (
                    <i key={q.id} data-on={!!guesses[q.id]} />
                  ))}
                </div>
                <small>
                  {step + 1} de {c.questions?.length}
                </small>
                <h2>{q.text}</h2>
                <div className="answer-options">
                  {q.options.map((o) => (
                    <button
                      key={o.id}
                      disabled={busy}
                      aria-pressed={guesses[q.id]?.optionId === o.id}
                      onClick={() =>
                        setGuesses({
                          ...guesses,
                          [q.id]: {
                            optionId: o.id,
                            confidence: guesses[q.id]?.confidence ?? 0.6,
                          },
                        })
                      }
                    >
                      <span>{o.id}</span>
                      {o.label}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>
                    Quanto você confia?{" "}
                    {Math.round((guesses[q.id]?.confidence ?? 0.6) * 100)}%
                  </span>
                  <input
                    type="range"
                    min=".25"
                    max="1"
                    step=".05"
                    disabled={busy || !guesses[q.id]}
                    value={guesses[q.id]?.confidence ?? 0.6}
                    onChange={(e) =>
                      setGuesses({
                        ...guesses,
                        [q.id]: {
                          ...guesses[q.id]!,
                          confidence: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <div className="row wrap">
                  <button
                    className="button button-secondary"
                    disabled={busy || step === 0}
                    onClick={() => setStep(step - 1)}
                  >
                    Voltar
                  </button>
                  {step < (c.questions?.length ?? 0) - 1 ? (
                    <button
                      className="button"
                      disabled={busy || !guesses[q.id]}
                      onClick={() => setStep(step + 1)}
                    >
                      Próxima →
                    </button>
                  ) : (
                    <button
                      className="button"
                      disabled={
                        busy || c.questions?.some((q) => !guesses[q.id])
                      }
                      onClick={() => void act("submit", { guesses })}
                    >
                      Confirmar e descobrir ↗
                    </button>
                  )}
                </div>
                <p className="field-hint">
                  Revise as escolhas antes de confirmar. Esta rodada só é
                  enviada ao final.
                </p>
              </>
            );
          })()}
        </section>
      ) : (
        <section className="world-pair-quiz">
          {worldError ? (
            <ErrorState message={worldError} />
          ) : !event ? (
            <Loading />
          ) : (
            <>
              <div className="comparison-grid">
                <article>
                  <span>01 / A leitura da pessoa</span>
                  <h2>O que {c.ownerName} previu?</h2>
                  <div className="options">
                    {event.opportunities.map((o) => (
                      <button
                        key={o.id}
                        className="choice"
                        disabled={busy}
                        aria-pressed={guesses.world?.optionId === o.id}
                        onClick={() =>
                          setGuesses({
                            world: {
                              optionId: o.id,
                              confidence: guesses.world?.confidence ?? 0.6,
                            },
                          })
                        }
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <label className="field">
                    <span>
                      Confiança na sua leitura:{" "}
                      {Math.round((guesses.world?.confidence ?? 0.6) * 100)}%
                    </span>
                    <input
                      type="range"
                      min=".25"
                      max="1"
                      step=".05"
                      disabled={!guesses.world || busy}
                      value={guesses.world?.confidence ?? 0.6}
                      onChange={(e) =>
                        setGuesses({
                          world: {
                            ...guesses.world!,
                            confidence: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                </article>
                <article>
                  <span>02 / A sua perspectiva</span>
                  <h2>E você, o que acha?</h2>
                  <div className="options">
                    {event.opportunities.map((o) => (
                      <button
                        key={o.id}
                        className="choice"
                        disabled={busy}
                        aria-pressed={own === o.id}
                        onClick={() => setOwn(o.id)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <label className="field">
                    <span>Sua confiança: {Math.round(confidence * 100)}%</span>
                    <input
                      type="range"
                      min=".5"
                      max=".99"
                      step=".01"
                      value={confidence}
                      disabled={busy}
                      onChange={(e) => setConfidence(Number(e.target.value))}
                    />
                  </label>
                </article>
              </div>
              <p>
                Você registra sua previsão antes da revelação. Depois que as
                escolhas forem compartilhadas, as previsões deste evento não
                poderão ser alteradas.
              </p>
              <details>
                <summary>Critério e fonte do acontecimento</summary>
                <p>{event.resolutionCriteria}</p>
                {event.sourceUrl && (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Consultar fonte ↗
                  </a>
                )}
              </details>
              <button
                className="button"
                disabled={busy || !own || !guesses.world}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await apiPost(`/world/events/${event.id}`, {
                      opportunityId: own,
                      confidence,
                    });
                    await act("submit", { guesses });
                  } catch (e) {
                    toast(describeError(e), "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Confirmar as duas perspectivas ↗
              </button>
            </>
          )}
        </section>
      )}
      {!closed && (
        <footer className="connection-footer">
          <p>
            Conexão privada. Encerrar oculta resultados e conversa para vocês
            dois.
          </p>
          {ending ? (
            <div className="row">
              <button
                className="button button-danger"
                disabled={busy}
                onClick={() => void act("revoke", {})}
              >
                Confirmar encerramento
              </button>
              <button className="text-link" onClick={() => setEnding(false)}>
                Voltar
              </button>
            </div>
          ) : (
            <button className="text-link" onClick={() => setEnding(true)}>
              Encerrar conexão
            </button>
          )}
        </footer>
      )}
    </>
  );
}

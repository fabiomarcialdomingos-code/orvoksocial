"use client";
/* eslint-disable react-hooks/set-state-in-effect -- data loading effects set state from API responses (same convention as CommandCenter). */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, describeError, loadPeople, personName, relativeTime, type Profile, type WorldEvent } from "../../lib/client/api";
import { useShell } from "./AppShell";
import r from "../rede/rede.module.css";

type Mine = { eventId: string; opportunityId: string; confidence: string | number; predictedAt: string };
type Comment = { id: string; authorId: string; body: string; createdAt: string };

const LOCK_MS = 10 * 60 * 1000;

export function World() {
  const { toast } = useShell();
  const [events, setEvents] = useState<WorldEvent[] | null>(null);
  const [mine, setMine] = useState<Map<string, Mine>>(new Map());
  const [category, setCategory] = useState("todas");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ev, pr] = await Promise.all([
        apiGet<{ items: WorldEvent[] }>("/world/events"),
        apiGet<{ items: Mine[] }>("/world/predictions"),
      ]);
      setEvents(ev.items);
      setMine(new Map(pr.items.map((p) => [p.eventId, p])));
    } catch (error) { toast(describeError(error), "error"); setEvents([]); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (events && location.hash) setOpen(location.hash.slice(1)); }, [events]);

  const categories = useMemo(() => ["todas", ...new Set((events ?? []).map((e) => e.category))], [events]);
  const list = (events ?? []).filter((e) => category === "todas" || e.category === category)
    .sort((a, b) => Number(b.status === "PUBLISHED") - Number(a.status === "PUBLISHED") || a.closesAt.localeCompare(b.closesAt));

  return (
    <>
      <section className={r.hero}>
        <small className={r.marcador}>Previsões do Mundo</small>
        <h2>O que vai acontecer?</h2>
        <p>Acontecimentos reais, com critério de resolução definido antes. Escolha um lado e diga o quanto confia. As previsões travam dez minutos antes do fechamento.</p>
        <div className={r.chips} role="group" aria-label="Filtrar por categoria">
          {categories.map((c) => (
            <button key={c} type="button" className={r.chip} aria-pressed={category === c} onClick={() => setCategory(c)}
              style={category === c ? { borderColor: "var(--people)", background: "rgb(76 141 255 / .16)" } : undefined}>
              {c === "todas" ? "Todas" : c[0]!.toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </section>
      {!events ? <p className={r.muted} aria-busy="true">Carregando…</p> :
        list.length === 0 ? (
          <div className={r.vazio}><strong>Nenhuma previsão aberta agora.</strong><span>Novas previsões aparecem aqui assim que forem publicadas.</span></div>
        ) : list.map((event) => (
          <EventCard key={event.id} event={event} mine={mine.get(event.id)} expanded={open === event.id}
            onToggle={() => setOpen(open === event.id ? null : event.id)} onPredicted={load} />
        ))}
    </>
  );
}

type Etapa = "escolher" | "confianca" | "registrar" | "registrada";

/**
 * Previsão em etapas, com efeitos: escolher uma opção abre a confiança;
 * mexer na confiança libera o botão; ao registrar, aparece a confirmação e a
 * caixa de comentários.
 */
function EventCard({ event, mine, expanded, onToggle, onPredicted }: {
  event: WorldEvent; mine?: Mine | undefined; expanded: boolean; onToggle: () => void; onPredicted: () => Promise<void>;
}) {
  const { toast } = useShell();
  const [choice, setChoice] = useState<string | null>(mine?.opportunityId ?? null);
  const [confidence, setConfidence] = useState(mine ? Number(mine.confidence) : 0.7);
  const [etapa, setEtapa] = useState<Etapa>(mine ? "registrada" : "escolher");
  const [recemRegistrada, setRecemRegistrada] = useState(false);
  const [pending, setPending] = useState(false);
  const [now] = useState(() => Date.now());
  const locked = event.status !== "PUBLISHED" || now >= new Date(event.closesAt).getTime() - LOCK_MS;
  const options = [...event.opportunities].sort((a, b) => a.position - b.position);
  const escolhida = options.find((o) => o.id === choice);
  const pct = Math.round(confidence * 100);
  const rotuloConfianca = pct >= 90 ? "Certeza quase total" : pct >= 75 ? "Bastante confiança" : pct >= 60 ? "Alguma confiança" : "Pouca certeza";

  const escolher = (id: string) => {
    if (locked) return;
    setChoice(id);
    setEtapa((e) => (e === "registrar" ? "registrar" : "confianca"));
    setRecemRegistrada(false);
  };
  const predict = async () => {
    if (!choice) return;
    setPending(true);
    try {
      await apiPost(`/world/events/${event.id}`, { opportunityId: choice, confidence });
      setEtapa("registrada"); setRecemRegistrada(true);
      await onPredicted();
    } catch (error) { toast(describeError(error), "error"); } finally { setPending(false); }
  };

  return (
    <article id={event.id} className={`${r.evento} ${etapa !== "escolher" ? r.eventoAtivo : ""}`}>
      <div className={r.rodapeEvento}>
        <span className={r.cat}>{event.category}</span>
        <span className={r.muted}>{locked ? statusLabel(event.status) : `fecha ${relativeTime(event.closesAt)}`}</span>
      </div>
      <h3>{event.title}</h3>

      {etapa === "registrada" && !locked ? (
        <div className={`${r.confirmada} ${recemRegistrada ? r.explode : ""}`}>
          <span className={r.selo}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg></span>
          <div>
            <b>{recemRegistrada ? "Previsão registrada!" : "Sua previsão"}</b>
            <span>{escolhida?.label ?? "—"}, com {pct}% de confiança</span>
          </div>
          <button type="button" className={r.linkSutil} onClick={() => { setEtapa("escolher"); setRecemRegistrada(false); }}>Mudar</button>
        </div>
      ) : (
        <div className={r.opcoes} role="radiogroup" aria-label="Sua previsão">
          {options.map((o) => (
            <button key={o.id} type="button" className={r.opcao} aria-pressed={choice === o.id} disabled={locked} onClick={() => escolher(o.id)}>
              <span>{o.label}</span>
              {choice === o.id ? <span className={r.marcaEscolha} aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      )}

      {!locked && (etapa === "confianca" || etapa === "registrar") ? (
        <div className={r.revela}>
          <div className={r.painelConfianca}>
            <div className={r.confiancaTopo}>
              <span>O quanto você confia em <b>{escolhida?.label}</b>?</span>
              <strong className={r.pct}>{pct}%</strong>
            </div>
            <input className={r.barra} type="range" min={0.5} max={0.99} step={0.01} value={confidence} aria-label="Confiança"
              style={{ ["--v" as string]: `${((confidence - 0.5) / 0.49) * 100}%` }}
              onChange={(e) => { setConfidence(Number(e.target.value)); setEtapa("registrar"); }} />
            <div className={r.confiancaRodape}><span>50%</span><em>{rotuloConfianca}</em><span>99%</span></div>
          </div>
        </div>
      ) : null}

      {!locked && etapa === "registrar" ? (
        <div className={r.revela}>
          <button type="button" className={`${r.btnP} ${r.registrar}`} disabled={pending} onClick={() => void predict()}>
            {pending ? "Registrando…" : mine ? "Atualizar minha previsão" : "Registrar minha previsão"}
          </button>
        </div>
      ) : null}

      {recemRegistrada ? <div className={r.revela}><Comentarios event={event} foco /></div> : null}

      <div className={r.rodapeEvento}>
        <button type="button" className={r.linkSutil} onClick={onToggle}>{expanded ? "Fechar detalhes" : "Como será resolvido e conversa"}</button>
      </div>
      {expanded && !recemRegistrada && <EventDetails event={event} />}
      {expanded && recemRegistrada && <div className={r.detalhes}><div><b>Como será resolvido</b><p style={{ margin: "4px 0 0" }}>{event.resolutionCriteria}</p></div></div>}
    </article>
  );
}

function statusLabel(status: string) {
  return ({ PUBLISHED: "travado para previsões", CLOSED: "fechado", RESOLVED: "resolvido", CANCELLED: "cancelado", VOID: "anulado" } as Record<string, string>)[status] ?? status.toLowerCase();
}

function EventDetails({ event }: { event: WorldEvent }) {
  return (
    <div className={r.detalhes}>
      <div><b>Como será resolvido</b><p style={{ margin: "4px 0 0" }}>{event.resolutionCriteria}</p></div>
      <div>Abriu {relativeTime(event.opensAt)}, fecha em {new Date(event.closesAt).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}</div>
      <Comentarios event={event} />
    </div>
  );
}

function Comentarios({ event, foco }: { event: WorldEvent; foco?: boolean }) {
  const { toast } = useShell();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());
  const [body, setBody] = useState("");
  const [enviado, setEnviado] = useState(false);
  const load = useCallback(async () => {
    const res = await apiGet<{ items: Comment[] }>(`/world/events/${event.id}/comments`);
    setPeople(new Map(await loadPeople(res.items.map((c) => c.authorId))));
    setComments(res.items);
  }, [event.id]);
  useEffect(() => { void load().catch(() => setComments([])); }, [load]);
  return (
    <div className={foco ? r.caixaComentario : undefined}>
      {foco ? <b>{enviado ? "Comentário publicado. Valeu!" : "Quer deixar o seu argumento?"}</b> : <b>Conversa</b>}
      {!comments ? null : comments.length === 0 ? (foco ? null : <p style={{ margin: "4px 0" }}>Ninguém comentou ainda.</p>) : comments.slice(-4).map((c) => (
        <p key={c.id} className={r.comentario}><b>{personName(people, c.authorId)}</b> <span className={r.muted}>{relativeTime(c.createdAt)}</span><br />{c.body}</p>
      ))}
      {!enviado ? (
        <form className={r.campoLinha} style={{ marginTop: 8 }} onSubmit={async (e) => {
          e.preventDefault();
          try { await apiPost(`/world/events/${event.id}/comments`, { body: body.trim() }); setBody(""); setEnviado(true); await load(); } catch (error) { toast(describeError(error), "error"); }
        }}>
          <input autoFocus={foco} value={body} onChange={(e) => setBody(e.target.value)} placeholder={foco ? "Por que você acha isso? (opcional)" : "Qual é o seu argumento?"} maxLength={2000} aria-label="Comentário" />
          <button className={r.btnFio} disabled={!body.trim()}>Comentar</button>
        </form>
      ) : null}
    </div>
  );
}

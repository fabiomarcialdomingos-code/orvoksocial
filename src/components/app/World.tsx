"use client";
/* eslint-disable react-hooks/set-state-in-effect -- data loading effects set state from API responses (same convention as CommandCenter). */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, describeError, loadPeople, personName, relativeTime, type Profile, type WorldEvent } from "../../lib/client/api";
import { useShell } from "./AppShell";

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
      <div className="page-head">
        <div>
          <h1 className="display">Mundo</h1>
          <p>Acontecimentos reais com critério de resolução definido antes. Escolha um lado e diga o quanto confia. As previsões travam dez minutos antes do fechamento.</p>
        </div>
        <div className="row" role="group" aria-label="Filtrar por categoria">
          {categories.map((c) => (
            <button key={c} className={category === c ? "button button-small" : "button button-small button-secondary"} data-p={category === c ? "world" : undefined}
              aria-pressed={category === c} onClick={() => setCategory(c)}>{c === "todas" ? "Todas" : c[0]!.toUpperCase() + c.slice(1)}</button>
          ))}
        </div>
      </div>
      {!events ? <div className="grid-2"><div className="skeleton" style={{ height: 220 }} /><div className="skeleton" style={{ height: 220 }} /></div> :
        list.length === 0 ? (
          <div className="empty"><strong>Nenhum evento publicado.</strong><span>Administradores pré-cadastram e revisam cada evento antes de abri-lo para previsões.</span></div>
        ) : (
          <div className="grid-2">
            {list.map((event) => (
              <EventCard key={event.id} event={event} mine={mine.get(event.id)} expanded={open === event.id}
                onToggle={() => setOpen(open === event.id ? null : event.id)} onPredicted={load} />
            ))}
          </div>
        )}
    </>
  );
}

function EventCard({ event, mine, expanded, onToggle, onPredicted }: {
  event: WorldEvent; mine?: Mine | undefined; expanded: boolean; onToggle: () => void; onPredicted: () => Promise<void>;
}) {
  const { toast } = useShell();
  const [choice, setChoice] = useState<string | null>(mine?.opportunityId ?? null);
  const [confidence, setConfidence] = useState(mine ? Number(mine.confidence) : 0.65);
  const [pending, setPending] = useState(false);
  const [now] = useState(() => Date.now());
  const locked = event.status !== "PUBLISHED" || now >= new Date(event.closesAt).getTime() - LOCK_MS;
  const options = [...event.opportunities].sort((a, b) => a.position - b.position);

  const predict = async () => {
    if (!choice) return;
    setPending(true);
    try {
      await apiPost(`/world/events/${event.id}`, { opportunityId: choice, confidence });
      toast("Previsão registrada com data e hash.");
      await onPredicted();
    } catch (error) { toast(describeError(error), "error"); } finally { setPending(false); }
  };

  return (
    <article id={event.id} className="card lit event" data-p="world">
      <div className="row-between">
        <span className="tag" data-p="world">{event.category}</span>
        <span className="faint countdown" style={{ fontSize: 14 }}>{locked ? statusLabel(event.status) : `fecha ${relativeTime(event.closesAt)}`}</span>
      </div>
      <h3>{event.title}</h3>
      <div className="choice-row" role="radiogroup" aria-label="Sua previsão">
        {options.map((o) => (
          <button key={o.id} type="button" className="choice" aria-pressed={choice === o.id} disabled={locked} onClick={() => setChoice(o.id)}>{o.label}</button>
        ))}
      </div>
      {!locked && (
        <div className="field">
          <span>Confiança: {Math.round(confidence * 100)}%</span>
          <input type="range" min={0.5} max={0.99} step={0.01} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} aria-label="Confiança" />
        </div>
      )}
      <div className="row-between">
        {mine ? <span className="faint" style={{ fontSize: 14 }}>Sua previsão: {options.find((o) => o.id === mine.opportunityId)?.label} com {Math.round(Number(mine.confidence) * 100)}%</span> : <span className="faint" style={{ fontSize: 14 }}>Você ainda não previu</span>}
        <div className="row">
          <button className="text-link" onClick={onToggle}>{expanded ? "Fechar detalhes" : "Critério e conversa"}</button>
          {!locked && <button className="button button-small" data-p="world" disabled={!choice || pending} onClick={() => void predict()}>{mine ? "Atualizar" : "Prever"}</button>}
        </div>
      </div>
      {expanded && <EventDetails event={event} />}
    </article>
  );
}

function statusLabel(status: string) {
  return ({ PUBLISHED: "travado para previsões", CLOSED: "fechado", RESOLVED: "resolvido", CANCELLED: "cancelado", VOID: "anulado" } as Record<string, string>)[status] ?? status.toLowerCase();
}

function EventDetails({ event }: { event: WorldEvent }) {
  const { toast } = useShell();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());
  const [body, setBody] = useState("");
  const load = useCallback(async () => {
    const r = await apiGet<{ items: Comment[] }>(`/world/events/${event.id}/comments`);
    setPeople(new Map(await loadPeople(r.items.map((c) => c.authorId))));
    setComments(r.items);
  }, [event.id]);
  useEffect(() => { void load().catch(() => setComments([])); }, [load]);
  return (
    <div className="stack" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
      <div><span className="eyebrow">Como será resolvido</span><p className="muted">{event.resolutionCriteria}</p></div>
      <div className="faint" style={{ fontSize: 14 }}>Abriu {relativeTime(event.opensAt)}, fecha em {new Date(event.closesAt).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}</div>
      <div>
        <span className="eyebrow">Conversa</span>
        {!comments ? <div className="skeleton" /> : comments.length === 0 ? <p className="faint">Ninguém comentou ainda.</p> : (
          <ul className="list">{comments.map((c) => <li key={c.id}><span className="grow"><strong style={{ fontWeight: 500 }}>{personName(people, c.authorId)}</strong> <span className="faint" style={{ fontSize: 13 }}>{relativeTime(c.createdAt)}</span><span className="muted" style={{ display: "block" }}>{c.body}</span></span></li>)}</ul>
        )}
        <form className="row" style={{ marginTop: 12 }} onSubmit={async (e) => {
          e.preventDefault();
          try { await apiPost(`/world/events/${event.id}/comments`, { body: body.trim() }); setBody(""); await load(); } catch (error) { toast(describeError(error), "error"); }
        }}>
          <input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Qual é o seu argumento?" maxLength={2000} aria-label="Comentário" />
          <button className="button button-small button-secondary" disabled={!body.trim()}>Comentar</button>
        </form>
      </div>
    </div>
  );
}

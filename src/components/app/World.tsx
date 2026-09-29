"use client";
/* eslint-disable react-hooks/set-state-in-effect -- data loading effects set state from API responses (same convention as CommandCenter). */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, describeError, loadPeople, personName, relativeTime, type Profile, type WorldEvent } from "../../lib/client/api";
import { IconeRede, useShell } from "./AppShell";
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
    <article id={event.id} className={r.evento}>
      <div className={r.rodapeEvento}>
        <span className={r.cat}>{event.category}</span>
        <span className={r.muted}>{locked ? statusLabel(event.status) : `fecha ${relativeTime(event.closesAt)}`}</span>
      </div>
      <h3>{event.title}</h3>
      <div className={r.opcoes} role="radiogroup" aria-label="Sua previsão">
        {options.map((o) => (
          <button key={o.id} type="button" className={r.opcao} aria-pressed={choice === o.id} disabled={locked} onClick={() => setChoice(o.id)}>
            <span>{o.label}</span>{mine?.opportunityId === o.id ? <span className={r.muted}>sua escolha</span> : null}
          </button>
        ))}
      </div>
      {!locked && (
        <label className={r.confianca}>
          <span>Confiança: <b style={{ color: "var(--text)" }}>{Math.round(confidence * 100)}%</b></span>
          <input type="range" min={0.5} max={0.99} step={0.01} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
        </label>
      )}
      <div className={r.rodapeEvento}>
        <button type="button" className={r.linkSutil} onClick={onToggle}><IconeRede nome="globo" /> {expanded ? "Fechar detalhes" : "Critério e conversa"}</button>
        {!locked && <button type="button" className={r.btnP} disabled={!choice || pending} onClick={() => void predict()}>{mine ? "Atualizar previsão" : "Prever"}</button>}
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
    <div className={r.detalhes}>
      <div><b>Como será resolvido</b><p style={{ margin: "4px 0 0" }}>{event.resolutionCriteria}</p></div>
      <div>Abriu {relativeTime(event.opensAt)}, fecha em {new Date(event.closesAt).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}</div>
      <div>
        <b>Conversa</b>
        {!comments ? <p>Carregando…</p> : comments.length === 0 ? <p style={{ margin: "4px 0" }}>Ninguém comentou ainda.</p> : comments.map((c) => (
          <p key={c.id} style={{ margin: "8px 0" }}><b>{personName(people, c.authorId)}</b> <span className={r.muted}>{relativeTime(c.createdAt)}</span><br />{c.body}</p>
        ))}
        <form className={r.campoLinha} style={{ marginTop: 8 }} onSubmit={async (e) => {
          e.preventDefault();
          try { await apiPost(`/world/events/${event.id}/comments`, { body: body.trim() }); setBody(""); await load(); } catch (error) { toast(describeError(error), "error"); }
        }}>
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Qual é o seu argumento?" maxLength={2000} aria-label="Comentário" />
          <button className={r.btnFio} disabled={!body.trim()}>Comentar</button>
        </form>
      </div>
    </div>
  );
}

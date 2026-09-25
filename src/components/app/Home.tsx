"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, loadPeople, personName, relativeTime, type Post, type Profile, type WorldEvent } from "../../lib/client/api";
import { angleFor, useRadar, type RadarState } from "../../lib/client/radar";
import { Instrument, type InstrumentNode } from "../ui/Instrument";
import { useShell } from "./AppShell";

function journey(radar: RadarState, me: string) {
  const total = radar.questions.length;
  const answered = radar.questions.filter((q) => radar.answers.has(q.questionVersionId)).length;
  const incoming = radar.invitations.filter((i) => i.targetId === me);
  const consented = radar.consents.filter((c) => c.purpose === "BE_PREDICTED" && !c.revokedAt);
  const received = radar.dashboard?.received.length ?? 0;
  const steps = [
    { key: "gabarito", title: "Seu gabarito", text: total ? `${answered} de ${total} respondidas` : "Catálogo indisponível", done: total > 0 && answered === total, href: "/onboarding", p: "self" as const },
    { key: "pedidos", title: "Pedidos", text: incoming.length ? `${incoming.length} recebido(s)` : "Nenhum pedido ainda", done: incoming.some((i) => i.acceptanceId), href: "/convites", p: "people" as const },
    { key: "consentimento", title: "Consentimento", text: consented.length ? `${consented.length} ativo(s)` : "Nada autorizado", done: consented.length > 0, href: "/convites", p: "people" as const },
    { key: "encontro", title: "O encontro", text: received ? `${received} previsão(ões) visíveis` : "Aguardando previsões", done: received > 0, href: "/resultado", p: "people" as const },
  ];
  const current = steps.findIndex((s) => !s.done);
  return { steps, current: current < 0 ? 3 : current, answered, total };
}

export function RadarHub() {
  const { session } = useShell();
  const me = session.userId!;
  const radar = useRadar(me);
  if (radar.loading) return <div className="skeleton" style={{ height: 360 }} aria-busy="true" />;
  const { steps, current } = journey(radar, me);
  const predictors = [...new Set(radar.invitations.filter((i) => i.targetId === me && i.acceptanceId).map((i) => i.predictorId))];
  const targets = [...new Set(radar.invitations.filter((i) => i.predictorId === me).map((i) => i.targetId))];
  const nodes: InstrumentNode[] = [
    { id: "me", label: "Você", p: "self", r: 0, angle: 0, size: 9 },
    ...predictors.map((id) => ({ id: "p" + id, label: `${personName(radar.people, id)} te prevê`, p: "people" as const, r: 0.45, angle: angleFor(id), linked: true, size: 6 })),
    ...targets.filter((id) => !predictors.includes(id)).map((id) => ({ id: "t" + id, label: `você prevê ${personName(radar.people, id)}`, p: "people" as const, r: 0.72, angle: angleFor(id, 40), size: 5 })),
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="display">Radar</h1>
          <p>Quem te conhece, quem você conhece, e o quanto essas leituras batem. Cada ligação só existe com pedido aceito e consentimento ativo.</p>
        </div>
        <Link className="button" data-p="people" href={steps[current]!.href}>{current === 0 ? "Responder gabarito" : current === 3 ? "Ver o encontro" : "Abrir pedidos"}</Link>
      </div>
      <nav className="journey" aria-label="Etapas do Radar">
        {steps.map((step, i) => (
          <Link key={step.key} href={step.href} className="journey-step lit" data-p={step.p} data-state={step.done ? "done" : i === current ? "current" : "todo"}
            aria-current={i === current ? "step" : undefined}>
            <span className="row"><span className="dot" />Etapa {i + 1}{step.done ? " · concluída" : ""}</span>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </Link>
        ))}
      </nav>
      <div className="grid-main" style={{ marginTop: 16 }}>
        <section className="card" aria-label="Seu radar">
          <div style={{ maxWidth: 520, margin: "0 auto" }}>
            <Instrument nodes={nodes} label="Seu radar de pessoas" />
          </div>
          {nodes.length === 1 && <p className="muted" style={{ textAlign: "center" }}>Seu radar ainda está vazio. As pessoas aparecem aqui quando pedidos são aceitos.</p>}
        </section>
        <div className="stack">
          <article className="card" data-p="people">
            <div className="row-between"><h3>Reciprocidade</h3><span className="tag" data-p="people">{radar.dashboard?.matches.length ?? 0}</span></div>
            {radar.dashboard?.matches.length ? (
              <ul className="list">{radar.dashboard.matches.map((m) => <li key={m.userId}><span className="dot" /><span className="grow">{personName(radar.people, m.userId)}</span><span className="faint">desde {relativeTime(m.mutualAt)}</span></li>)}</ul>
            ) : <p className="muted" style={{ marginTop: 8 }}>Quando vocês dois se preverem, a conexão aparece aqui.</p>}
          </article>
          <article className="card">
            <h3>Atalhos</h3>
            <ul className="list">
              <li><span className="grow">Prever quem já consentiu</span><Link className="text-link" href="/previsao">Prever</Link></li>
              <li><span className="grow">Revisar minhas respostas</span><Link className="text-link" href="/onboarding">Gabarito</Link></li>
              <li><span className="grow">Revogar ou exportar dados</span><Link className="text-link" href="/meus-dados">Privacidade</Link></li>
            </ul>
          </article>
        </div>
      </div>
    </>
  );
}

export function Dashboard() {
  const { session, profile } = useShell();
  const me = session.userId!;
  const radar = useRadar(me);
  const [events, setEvents] = useState<WorldEvent[] | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [authors, setAuthors] = useState<Map<string, Profile>>(new Map());

  useEffect(() => {
    apiGet<{ items: WorldEvent[] }>("/world/events").then((r) => setEvents(r.items.filter((e) => e.status === "PUBLISHED"))).catch(() => setEvents([]));
    apiGet<{ items: Post[] }>("/social/feed").then(async (r) => {
      setAuthors(new Map(await loadPeople(r.items.map((p) => p.authorId))));
      setPosts(r.items.slice(0, 3));
    }).catch(() => setPosts([]));
  }, []);

  const first = profile?.displayName.split(" ")[0];
  const j = radar.loading ? null : journey(radar, me);
  const next = j?.steps[j.current];
  const canPredict = new Set(radar.opportunities.map((o) => o.targetId)).size;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="display">{first ? `Olá, ${first}.` : "Olá."}</h1>
          <p>{next && !next.done ? `Próximo passo: ${next.title.toLowerCase()}. ${next.text}.` : "Seu radar está em dia. Que tal prever o mundo hoje?"}</p>
        </div>
        {next && !next.done && <Link className="button" data-p={next.p} href={next.href}>Continuar</Link>}
      </div>

      <div className="grid-3">
        <Link href="/onboarding" className="card lit metric" data-p="self">
          <span className="eyebrow">Você</span>
          <span className="num">{j ? `${j.answered}/${j.total}` : "–"}</span>
          <small>respostas no gabarito</small>
        </Link>
        <Link href="/radar" className="card lit metric" data-p="people">
          <span className="eyebrow">Pessoas</span>
          <span className="num">{radar.loading ? "–" : radar.dashboard?.received.length ?? 0}</span>
          <small>previsões sobre você visíveis{canPredict ? ` · ${canPredict} pessoa(s) para prever` : ""}</small>
        </Link>
        <Link href="/eventos" className="card lit metric" data-p="world">
          <span className="eyebrow">Mundo</span>
          <span className="num">{events ? events.length : "–"}</span>
          <small>eventos abertos para previsão</small>
        </Link>
      </div>

      <div className="grid-main" style={{ marginTop: 16 }}>
        <section className="card" data-p="world" aria-labelledby="ev-title">
          <div className="row-between"><h2 id="ev-title">Fechando em breve</h2><Link className="text-link" href="/eventos">Todos os eventos</Link></div>
          {!events ? <div className="skeleton" style={{ height: 120, marginTop: 16 }} /> : events.length === 0 ? <p className="muted" style={{ marginTop: 12 }}>Nenhum evento aberto agora.</p> : (
            <ul className="list">
              {[...events].sort((a, b) => a.closesAt.localeCompare(b.closesAt)).slice(0, 4).map((e) => (
                <li key={e.id}><span className="dot" style={{ background: "var(--world)" }} /><span className="grow">{e.title}<span className="faint" style={{ display: "block", fontSize: 13 }}>{e.category} · fecha {relativeTime(e.closesAt)}</span></span><Link className="text-link" href={`/eventos#${e.id}`}>Prever</Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="feed-title">
          <div className="row-between"><h2 id="feed-title">No feed</h2><Link className="text-link" href="/feed">Abrir</Link></div>
          {!posts ? <div className="skeleton" style={{ height: 120, marginTop: 16 }} /> : posts.length === 0 ? <p className="muted" style={{ marginTop: 12 }}>Ninguém publicou ainda.</p> : (
            <ul className="list">{posts.map((p) => <li key={p.id}><span className="grow"><strong style={{ fontWeight: 500 }}>{personName(authors, p.authorId)}</strong><span className="muted" style={{ display: "block", fontSize: 14 }}>{p.body.length > 110 ? p.body.slice(0, 110) + "…" : p.body}</span></span></li>)}</ul>
          )}
        </section>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, describeError, loadPeople, personName, type Profile, type Question } from "../../lib/client/api";
import { angleFor } from "../../lib/client/radar";
import { Instrument, type InstrumentNode } from "../ui/Instrument";
import { useShell } from "./AppShell";

type EncounterData = {
  answers: { questionVersionId: string; optionId: string }[];
  received: { id: string; predictorId: string; questionVersionId: string; probabilityVector: number[] }[];
  questions: Question[];
};

export function Encounter() {
  const { session } = useShell();
  const [data, setData] = useState<EncounterData | null>(null);
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"geral" | "pergunta">("geral");

  useEffect(() => {
    apiGet<EncounterData>("/radar/encounter")
      .then(async (result) => {
        result.questions.forEach((q) => q.options.sort((a, b) => a.position - b.position));
        setPeople(new Map(await loadPeople(result.received.map((r) => r.predictorId))));
        setData(result);
      })
      .catch((e) => setError(describeError(e)));
  }, [session.userId]);

  const analysis = useMemo(() => {
    if (!data) return null;
    const answerOf = new Map(data.answers.map((a) => [a.questionVersionId, a.optionId]));
    const qById = new Map(data.questions.map((q) => [q.questionVersionId, q]));
    const predictors = [...new Set(data.received.map((r) => r.predictorId))];
    const cells = new Map<string, { hit: boolean; guess: string; weight: number }>();
    for (const r of data.received) {
      const q = qById.get(r.questionVersionId);
      const mine = answerOf.get(r.questionVersionId);
      if (!q || !mine) continue;
      const top = r.probabilityVector.indexOf(Math.max(...r.probabilityVector));
      const mineIndex = q.options.findIndex((o) => o.id === mine);
      cells.set(`${r.predictorId}:${r.questionVersionId}`, { hit: top === mineIndex, guess: q.options[top]?.label ?? "", weight: r.probabilityVector[mineIndex] ?? 0 });
    }
    const perPerson = predictors.map((id) => {
      const mine = [...cells.entries()].filter(([k]) => k.startsWith(id + ":")).map(([, v]) => v);
      return { id, total: mine.length, hits: mine.filter((c) => c.hit).length };
    }).sort((a, b) => b.hits / (b.total || 1) - a.hits / (a.total || 1));
    const rows = data.questions.filter((q) => answerOf.has(q.questionVersionId) && predictors.some((p) => cells.has(`${p}:${q.questionVersionId}`)))
      .map((q) => {
        const list = predictors.map((p) => cells.get(`${p}:${q.questionVersionId}`)).filter(Boolean) as { hit: boolean }[];
        return { q, mine: q.options.find((o) => o.id === answerOf.get(q.questionVersionId))?.label ?? "", hits: list.filter((c) => c.hit).length, n: list.length };
      });
    const surprises = rows.filter((r) => r.n > 0 && r.hits === 0);
    const consensus = rows.filter((r) => r.n > 1 && r.hits === r.n);
    return { predictors, perPerson, rows, cells, surprises, consensus };
  }, [data]);

  if (error) return <div className="empty"><strong>O encontro não carregou.</strong><span>{error}</span></div>;
  if (!data || !analysis) return <div className="skeleton" style={{ height: 360 }} aria-busy="true" />;

  if (!analysis.predictors.length) {
    return (
      <>
        <div className="page-head"><div><h1 className="display">O encontro</h1><p>Quando pessoas que você autorizou registrarem previsões, você verá aqui onde elas acertam e onde você surpreende.</p></div></div>
        <div className="empty">
          <strong>Ainda não há previsões visíveis para você.</strong>
          <span>Só aparecem previsões de quem você autorizou com a opção “Eu e a pessoa”. Revogar um consentimento remove as previsões daqui.</span>
          <Link className="button" data-p="people" href="/convites">Ver pedidos</Link>
        </div>
      </>
    );
  }

  const nodes: InstrumentNode[] = [
    { id: "me", label: "Você", p: "self", r: 0, angle: 0, size: 9 },
    ...analysis.perPerson.map((p) => ({
      id: p.id, label: `${personName(people, p.id)}: ${p.hits} de ${p.total}`, p: "people" as const,
      r: 0.2 + 0.72 * (1 - p.hits / (p.total || 1)), angle: angleFor(p.id), size: 7, linked: true,
    })),
  ];
  const best = analysis.perPerson[0]!;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="display">Onde as perspectivas se encontram</h1>
          <p>Cada pessoa aparece mais perto do centro quanto mais respostas suas ela antecipou. Nada disso é público: só você vê esta página.</p>
        </div>
        <div className="row" role="tablist" aria-label="Visualização">
          <button role="tab" aria-selected={view === "geral"} className={view === "geral" ? "button button-small" : "button button-small button-secondary"} onClick={() => setView("geral")}>Visão geral</button>
          <button role="tab" aria-selected={view === "pergunta"} className={view === "pergunta" ? "button button-small" : "button button-small button-secondary"} onClick={() => setView("pergunta")}>Por pergunta</button>
        </div>
      </div>

      {view === "geral" ? (
        <div className="grid-main">
          <section className="card" aria-label="Radar do encontro">
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <Instrument nodes={nodes} label="Radar do encontro: pessoas mais próximas do centro acertaram mais" sweep={false} />
            </div>
          </section>
          <div className="stack">
            <article className="card lit" data-p="people">
              <span className="eyebrow">Quem mais te antecipa</span>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 450 }}>{personName(people, best.id)}</h3>
              <p className="muted" style={{ marginTop: 6 }}>Acertou {best.hits} das {best.total} perguntas que previu.</p>
              <div className="meter" style={{ marginTop: 14 }}><i style={{ width: `${(best.hits / (best.total || 1)) * 100}%` }} /></div>
            </article>
            <article className="card lit" data-p="self">
              <span className="eyebrow">Onde você surpreende</span>
              {analysis.surprises.length ? (
                <ul className="list">{analysis.surprises.slice(0, 3).map((r) => <li key={r.q.questionVersionId}><span className="grow">{r.q.text}<span className="faint" style={{ display: "block", fontSize: 13 }}>Você: {r.mine}</span></span></li>)}</ul>
              ) : <p className="muted">Ninguém errou todas em nenhuma pergunta. Você é bem lido.</p>}
            </article>
            {analysis.consensus.length > 0 && (
              <article className="card" data-p="people">
                <span className="eyebrow">Todos acertaram</span>
                <ul className="list">{analysis.consensus.slice(0, 3).map((r) => <li key={r.q.questionVersionId}><span className="grow">{r.q.text}</span></li>)}</ul>
              </article>
            )}
          </div>
        </div>
      ) : (
        <section className="card" aria-label="Comparação por pergunta">
          <div className="table-wrap">
            <div className="align-grid" style={{ ["--cols" as string]: analysis.perPerson.length + 1, minWidth: 560 }}>
              <div className="align-row head"><span>Pergunta</span><span>Sua resposta</span>{analysis.perPerson.map((p) => <span key={p.id}>{personName(people, p.id)}</span>)}</div>
              {analysis.rows.map((row) => (
                <div className="align-row" key={row.q.questionVersionId}>
                  <span>{row.q.text}</span>
                  <span style={{ color: "var(--self)" }}>{row.mine}</span>
                  {analysis.perPerson.map((p) => {
                    const cell = analysis.cells.get(`${p.id}:${row.q.questionVersionId}`);
                    if (!cell) return <span key={p.id} className="faint">Não previu</span>;
                    return <span key={p.id} className={cell.hit ? "cell-hit" : "cell-miss"} title={`Apostou ${Math.round(cell.weight * 100)}% na sua resposta`}>{cell.hit ? "Acertou" : cell.guess}</span>;
                  })}
                </div>
              ))}
            </div>
          </div>
          <p className="faint" style={{ marginTop: 16, fontSize: 14 }}>“Acertou” significa que a opção mais provável para a pessoa foi a sua resposta. Pontuações matemáticas oficiais seguem desativadas até aprovação.</p>
        </section>
      )}
    </>
  );
}

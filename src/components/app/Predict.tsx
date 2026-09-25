"use client";
/* eslint-disable react-hooks/set-state-in-effect -- data loading effects set state from API responses (same convention as CommandCenter). */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, describeError, initials, personName } from "../../lib/client/api";
import { useRadar } from "../../lib/client/radar";
import { useShell } from "./AppShell";

type Made = { id: string; targetId: string; questionVersionId: string; probabilityVector: number[]; predictedAt: string };
const KEYS = ["A", "B", "C", "D", "E", "F"];

/** Build a probability vector in exact micro-units so the database sum is 1. */
function vectorFor(n: number, chosen: number, confidence: number): number[] {
  const unit = 1_000_000;
  const main = Math.round(confidence * unit);
  const other = Math.floor((unit - main) / (n - 1));
  const top = unit - other * (n - 1);
  return Array.from({ length: n }, (_, i) => (i === chosen ? top : other) / unit);
}

export function Predict() {
  const { session, toast } = useShell();
  const radar = useRadar(session.userId);
  const params = useSearchParams();
  const [made, setMade] = useState<Made[]>([]);
  const [target, setTarget] = useState<string | null>(params.get("pessoa"));
  const [qIndex, setQIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(0.6);
  const [saving, setSaving] = useState(false);

  const loadMade = useCallback(() => apiGet<{ items: Made[] }>("/radar/made").then((r) => setMade(r.items)).catch(() => undefined), []);
  useEffect(() => { void loadMade(); }, [loadMade]);

  const targets = useMemo(() => [...new Set(radar.opportunities.map((o) => o.targetId))], [radar.opportunities]);
  useEffect(() => { if (!target && targets[0]) setTarget(targets[0]); }, [target, targets]);

  const items = useMemo(() => {
    const list = radar.opportunities.filter((o) => o.targetId === target);
    const order = new Map(radar.questions.map((q, i) => [q.questionVersionId, i]));
    return list.sort((a, b) => (order.get(a.questionVersionId) ?? 0) - (order.get(b.questionVersionId) ?? 0));
  }, [radar.opportunities, radar.questions, target]);

  const item = items[Math.min(qIndex, Math.max(0, items.length - 1))];
  const question = radar.questions.find((q) => q.questionVersionId === item?.questionVersionId);
  const previous = made.find((m) => m.targetId === target && m.questionVersionId === item?.questionVersionId);

  useEffect(() => {
    if (previous && question) {
      const top = previous.probabilityVector.indexOf(Math.max(...previous.probabilityVector));
      setChosen(top);
      setConfidence(Math.max(...previous.probabilityVector));
    } else { setChosen(null); setConfidence(0.6); }
  }, [previous, question]);

  if (radar.loading) return <div className="skeleton" style={{ height: 320 }} aria-busy="true" />;

  if (!targets.length) {
    return (
      <>
        <div className="page-head"><div><h1 className="display">Prever alguém</h1><p>Aqui aparecem as pessoas que aceitaram e consentiram o seu pedido.</p></div></div>
        <div className="empty">
          <strong>Ninguém disponível para prever ainda.</strong>
          <span>Envie um pedido pelo e-mail da pessoa. Quando ela aceitar e consentir, as perguntas aparecem aqui. Lembre-se: você também precisa ter respondido o seu gabarito.</span>
          <div className="row"><Link className="button" data-p="people" href="/convites">Enviar pedido</Link><Link className="button button-secondary" href="/onboarding">Meu gabarito</Link></div>
        </div>
      </>
    );
  }

  const doneFor = (id: string) => made.filter((m) => m.targetId === id).length;
  const totalFor = (id: string) => radar.opportunities.filter((o) => o.targetId === id).length;
  const name = target ? personName(radar.people, target) : "";
  const vector = question && chosen !== null ? vectorFor(question.options.length, chosen, confidence) : null;

  const submit = async () => {
    if (!item || !vector) return;
    setSaving(true);
    try {
      await apiPost("/radar/predictions", {
        targetId: item.targetId, questionVersionId: item.questionVersionId, selfAnswerVersionId: item.selfAnswerVersionId,
        grantId: item.grantId, probabilityVector: vector, ...(previous ? { supersedesId: previous.id } : {}),
      });
      await loadMade();
      if (qIndex + 1 < items.length) setQIndex(qIndex + 1);
      else toast(`Previsões sobre ${name} registradas. Ela verá o encontro se escolheu acompanhar.`);
    } catch (error) { toast(describeError(error), "error"); } finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="display">Prever {name}</h1>
          <p>Escolha a resposta que você acha que {name} deu e diga o quanto confia. A sua previsão fica registrada com data e com a versão do consentimento dela.</p>
        </div>
      </div>
      <div className="grid-main" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,8fr)" }}>
        <aside className="card" aria-label="Pessoas para prever">
          <ul className="list">
            {targets.map((id) => {
              const n = personName(radar.people, id);
              return (
                <li key={id}>
                  <button type="button" className="row" style={{ border: 0, background: "none", width: "100%", textAlign: "left", padding: 0, color: "inherit" }}
                    aria-current={id === target} onClick={() => { setTarget(id); setQIndex(0); }}>
                    <span className="avatar" data-p="people">{initials(n)}</span>
                    <span className="grow"><strong style={{ color: id === target ? "var(--people)" : undefined }}>{n}</strong>
                      <span className="faint" style={{ display: "block", fontSize: 13 }}>{doneFor(id)} de {totalFor(id)} previstas</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {question && item ? (
          <section className="card" data-p="people" aria-labelledby="pq">
            <div className="quiz-progress">
              {items.map((it, i) => (
                <i key={it.questionVersionId} data-on={made.some((m) => m.targetId === target && m.questionVersionId === it.questionVersionId)}
                  style={i === qIndex ? { outline: "1px solid var(--people)", outlineOffset: 2 } : undefined} />
              ))}
            </div>
            <div className="row-between">
              <span className="eyebrow">Pergunta {qIndex + 1} de {items.length}</span>
              {previous && <span className="tag" data-p="people">Você já previu esta; enviar de novo substitui</span>}
            </div>
            <h2 id="pq" className="display" style={{ fontSize: "clamp(1.4rem,2.6vw,2rem)", maxWidth: "26ch" }}>{question.text}</h2>
            <p className="muted" style={{ marginTop: 8 }}>O que {name} respondeu?</p>
            <div className="options" role="radiogroup" aria-labelledby="pq" style={{ marginTop: 16 }}>
              {question.options.map((option, i) => (
                <button key={option.id} type="button" role="radio" aria-checked={chosen === i} className="option" style={{ ["--self" as string]: "var(--people)" }}
                  onClick={() => setChosen(i)}>
                  <span className="key">{KEYS[i]}</span><span className="grow">{option.label}</span>
                  {vector && <span className="faint" style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(vector[i]! * 100)}%</span>}
                </button>
              ))}
            </div>
            <div className="field" style={{ marginTop: 24 }}>
              <span>Confiança: {Math.round(confidence * 100)}%</span>
              <input type="range" min={0.3} max={0.95} step={0.05} value={confidence} disabled={chosen === null}
                onChange={(e) => setConfidence(Number(e.target.value))} aria-label="Confiança na previsão" />
              <span className="field-hint">O restante é dividido entre as outras opções. Confiança alta que erra pesa mais do que confiança baixa.</span>
            </div>
            <div className="form-actions">
              <button className="button button-secondary" disabled={qIndex === 0} onClick={() => setQIndex(qIndex - 1)}>Anterior</button>
              <button className="button" data-p="people" disabled={chosen === null || saving} onClick={() => void submit()}>
                {saving ? "Registrando…" : qIndex + 1 < items.length ? "Registrar e seguir" : "Registrar última"}
              </button>
              {qIndex + 1 < items.length && <button className="text-link" onClick={() => setQIndex(qIndex + 1)}>Pular</button>}
            </div>
          </section>
        ) : <div className="empty"><strong>Sem perguntas para esta pessoa agora.</strong></div>}
      </div>
    </>
  );
}

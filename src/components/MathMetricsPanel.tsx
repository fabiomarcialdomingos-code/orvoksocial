"use client";

import { useEffect, useState } from "react";

type Props = { enabled: boolean };
type Score = { score: number; baseline: number; gain: number; nEff: number; margin: number | null; state: string; calculationRunId: string; createdAt: string } | null;
type Radar = { gamma: number; gammaCi95: [number, number] | null; nEff: number; rA: number; rB: number; state: string; calculationRunId: string; createdAt: string };

export function MathMetricsPanel({ enabled }: Props) {
  const [score, setScore] = useState<Score>(null);
  const [radar, setRadar] = useState<Radar | null>(null);
  const [reputation, setReputation] = useState<{ value: number; evidenceState: string; calculationRunId: string } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    Promise.all([
      fetch("/api/v1/math/score", { credentials: "same-origin", cache: "no-store", signal: controller.signal }).then((response) => response.ok ? response.json() as Promise<{ item: Score }> : { item: null }),
      fetch("/api/v1/math/radar", { credentials: "same-origin", cache: "no-store", signal: controller.signal }).then((response) => response.ok ? response.json() as Promise<{ items: Radar[] }> : { items: [] }),
      fetch("/api/v1/math/reputation", { credentials: "same-origin", cache: "no-store", signal: controller.signal }).then((response) => response.ok ? response.json() as Promise<{ item: typeof reputation }> : { item: null }),
    ]).then(([world, human, rep]) => {
      if (controller.signal.aborted) return;
      setScore(world.item); setRadar(human.items[0] ?? null); setReputation(rep.item); setState(world.item || human.items[0] || rep.item ? "ready" : "empty");
    }).catch(() => { if (!controller.signal.aborted) setState("empty"); });
    return () => controller.abort();
  }, [enabled]);

  if (!enabled) return null;
  return <section className="social-card math-metrics" aria-labelledby="math-metrics-title">
    <header className="social-section-title"><span className="eyebrow">Motor Matemático V1 · INTERNO</span><h2 id="math-metrics-title">Evidências persistidas</h2><p className="muted">Valores carregados dos snapshots versionados. A publicação externa permanece bloqueada.</p></header>
    {state === "loading" && <p role="status">Carregando artefatos persistidos…</p>}
    {state === "empty" && <p className="social-empty" role="status">Ainda não há cálculos persistidos para esta conta.</p>}
    {state === "ready" && <><div className="stat-grid">
      {score && <><Metric label="Score Brier" value={score.score.toFixed(4)} hint={"N_eff=" + score.nEff + " · " + score.state} /><Metric label="Baseline" value={score.baseline.toFixed(4)} hint="climatologia empírica" /><Metric label="Ganho" value={score.gain.toFixed(4)} hint={"margem " + (score.margin?.toFixed(4) ?? "—")} /></>}
      {radar && <><Metric label="Radar γ" value={radar.gamma.toFixed(4)} hint={"IC95% " + formatInterval(radar.gammaCi95)} /><Metric label="Estado Radar" value={radar.state} hint={"n_eff=" + radar.nEff + " · R_A=" + radar.rA + " · R_B=" + radar.rB} /></>}
      {reputation && <Metric label="Reputação interna" value={reputation.value.toFixed(4)} hint={reputation.evidenceState} />}
    </div><dl className="radar-record math-provenance"><div><dt>Origem</dt><dd>MathCalculationRun versionado</dd></div><div><dt>Execução</dt><dd>{score?.calculationRunId ?? radar?.calculationRunId ?? reputation?.calculationRunId}</dd></div><div><dt>Publicação</dt><dd>Bloqueada por feature flag</dd></div></dl></>}
  </section>;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="social-card stat"><span className="eyebrow">{label}</span><strong>{value}</strong><span className="muted">{hint}</span></div>;
}
function formatInterval(interval: [number, number] | null) { return interval ? "[" + interval[0].toFixed(4) + ", " + interval[1].toFixed(4) + "]" : "—"; }

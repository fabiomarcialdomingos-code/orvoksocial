import { consensusLeaveOneOut, estimateRadar, scoreWorldBinary } from "../lib/math-engine";

type MathMetricsPanelProps = { enabled: boolean };

/**
 * Controlled local/staging view of versioned mathematical artifacts.
 * It deliberately uses deterministic TEST_ONLY observations and does not
 * read or expose production/user data. Publication gates remain separate.
 */
export function MathMetricsPanel({ enabled }: MathMetricsPanelProps) {
  if (!enabled) return null;

  const world = scoreWorldBinary([0.8, 0.6, 0.4, 0.7, 0.3], [1, 0, 1, 1, 0], 5);
  const consensus = consensusLeaveOneOut([
    { predictorId: "TEST_PREDICTOR_A", probability: 0.72 },
    { predictorId: "TEST_PREDICTOR_B", probability: 0.61 },
    { predictorId: "TEST_PREDICTOR_C", probability: 0.55 },
    { predictorId: "TEST_PREDICTOR_D", probability: 0.68 },
    { predictorId: "TEST_PREDICTOR_E", probability: 0.64 },
    { predictorId: "TEST_PREDICTOR_F", probability: 0.59 },
  ], "TEST_PREDICTOR_A");
  const radar = estimateRadar([
    { predictorId: "TEST_PREDICTOR_A", targetId: "TEST_TARGET_A", predicted: 0.72, actual: 0.8 },
    { predictorId: "TEST_PREDICTOR_A", targetId: "TEST_TARGET_B", predicted: 0.41, actual: 0.3 },
    { predictorId: "TEST_PREDICTOR_B", targetId: "TEST_TARGET_A", predicted: 0.63, actual: 0.7 },
    { predictorId: "TEST_PREDICTOR_B", targetId: "TEST_TARGET_B", predicted: 0.52, actual: 0.4 },
  ]);

  return (
    <section className="social-card math-metrics" aria-labelledby="math-metrics-title">
      <header className="social-section-title">
        <span className="eyebrow">Motor Matemático V1 · TEST_ONLY</span>
        <h2 id="math-metrics-title">Evidências calculadas</h2>
        <p className="muted">Fixtures determinísticas para inspeção local/homologação. Nenhum dado de usuário é consultado.</p>
      </header>
      <div className="stat-grid">
        <Metric label="Score Brier" value={world.score.toFixed(4)} hint={`N=${world.n} · ${world.state}`} />
        <Metric label="Baseline" value={world.baseline.toFixed(4)} hint="climatologia empírica" />
        <Metric label="Ganho" value={world.gain.toFixed(4)} hint={`margem ${world.margin?.toFixed(4) ?? "—"}`} />
        <Metric label="Consenso LOO" value={consensus === null ? "—" : consensus.toFixed(4)} hint="quórum operacional" />
        <Metric label="Radar γ" value={radar.gamma.toFixed(4)} hint={`IC95% ${formatInterval(radar.gammaCi95)}`} />
        <Metric label="Estado Radar" value={radar.state} hint={`n_eff=${radar.nEff.toFixed(2)} · R_A=${radar.rA} · R_B=${radar.rB}`} />
      </div>
      <dl className="radar-record math-provenance">
        <div><dt>Algoritmo mundo</dt><dd>{world.algorithmVersion}</dd></div>
        <div><dt>Algoritmo Radar</dt><dd>{radar.algorithmVersion}</dd></div>
        <div><dt>Parâmetros</dt><dd>{Object.entries(radar.parameters).map(([key, value]) => `${key}=${String(value)}`).join(" · ")}</dd></div>
        <div><dt>Ranking e reputação</dt><dd>Barreira de publicação fechada</dd></div>
      </dl>
      <p className="form-message" role="status">A exibição é exclusiva de ambiente autorizado. Publicação externa, ranking e reputação permanecem bloqueados pelas flags de release.</p>
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="social-card stat"><span className="eyebrow">{label}</span><strong>{value}</strong><span className="muted">{hint}</span></div>;
}

function formatInterval(interval: [number, number] | null) {
  return interval ? `[${interval[0].toFixed(4)}, ${interval[1].toFixed(4)}]` : "—";
}

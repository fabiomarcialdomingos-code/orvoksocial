/**
 * ORVOK Mathematical Engine V1.
 *
 * This module is deliberately side-effect free. It calculates internal,
 * versioned artifacts only. Publication, ranking and reputation are kept
 * behind disabled feature flags and are not exposed by this module.
 */

export const ENGINE_VERSION = "MATH-ENGINE-V1.0.0";
export const WORLD_ALGORITHM_VERSION = "WORLD-BRIER-V1";
export const CONSENSUS_ALGORITHM_VERSION = "CONSENSUS-LOGL-LOO-V1";
export const RADAR_ALGORITHM_VERSION = "RADAR-CROSS-SHRINK-01";
export const TIME_WEIGHT_VERSION = "TIME-180D-ORVOK-MATH-V1";
export const CLUSTER_ALGORITHM_VERSION = "CLUSTER-KISH-CANDIDATE-01";

export const MATH_FEATURE_FLAGS = Object.freeze({
  computeInternal: true,
  publishScore: false,
  publishRadarScore: false,
  publishRanking: false,
  publishReputation: false,
});

export type EvidenceState = "INITIAL" | "EVALUATION" | "SUFFICIENT";

export interface ScoreArtifact {
  score: number;
  baseline: number;
  gain: number;
  n: number;
  nEff: number;
  margin: number | null;
  state: EvidenceState;
  algorithmVersion: string;
  parameters: Record<string, number | string>;
}

const EPSILON = 1e-12;
const WORLD_SUFFICIENT_N = 97;
const CLIP_MIN = 0.05;
const CLIP_MAX = 0.95;
const QUORUM = 5;
const LAMBDA = Math.log(2) / 180;

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}

function probability(value: number, name = "probability"): number {
  finite(value, name);
  if (value < 0 || value > 1) throw new RangeError(`${name} must be between 0 and 1`);
  return value;
}

export function clipProbability(value: number, min = CLIP_MIN, max = CLIP_MAX): number {
  probability(value);
  if (!(min > 0 && max < 1 && min < max)) throw new RangeError("invalid clipping bounds");
  return Math.min(max, Math.max(min, value));
}

export function brierBinary(prediction: number, outcome: 0 | 1): number {
  probability(prediction, "prediction");
  if (outcome !== 0 && outcome !== 1) throw new RangeError("binary outcome must be 0 or 1");
  return (prediction - outcome) ** 2;
}

export function brierMulticlass(prediction: readonly number[], outcomeIndex: number): number {
  if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0 || outcomeIndex >= prediction.length) throw new RangeError("invalid outcome index");
  if (prediction.length < 2) throw new RangeError("multiclass prediction needs at least two classes");
  const total = prediction.reduce((sum, p) => sum + probability(p), 0);
  if (Math.abs(total - 1) > 1e-9) throw new RangeError("multiclass probabilities must sum to one");
  return prediction.reduce((sum, p, index) => sum + (p - (index === outcomeIndex ? 1 : 0)) ** 2, 0);
}

export function binaryBaseline(outcomes: readonly (0 | 1)[]): number {
  if (outcomes.length === 0) throw new RangeError("baseline requires observations");
  return outcomes.reduce<number>((sum, outcome) => sum + outcome, 0) / outcomes.length;
}

export function multiclassBaseline(outcomes: readonly number[], classes: number): number[] {
  if (!Number.isInteger(classes) || classes < 2 || outcomes.length === 0) throw new RangeError("invalid baseline inputs");
  const counts = Array.from({ length: classes }, () => 0);
  for (const outcome of outcomes) {
    if (!Number.isInteger(outcome) || outcome < 0 || outcome >= classes) throw new RangeError("invalid outcome");
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }
  return counts.map((count) => count / outcomes.length);
}

function normalMargin(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1);
  return 1.96 * Math.sqrt(variance / values.length);
}

export function worldState(nEff: number): EvidenceState {
  finite(nEff, "nEff");
  if (nEff <= 0) return "INITIAL";
  return nEff >= WORLD_SUFFICIENT_N ? "SUFFICIENT" : "EVALUATION";
}

export function radarState(nEff: number, rA: number, rB: number, ciExcludesZero: boolean): EvidenceState {
  finite(nEff, "nEff");
  if (nEff < 44) return "INITIAL";
  if (nEff >= 90 && rA >= 10 && rB >= 10 && ciExcludesZero) return "SUFFICIENT";
  return "EVALUATION";
}

export function scoreWorldBinary(predictions: readonly number[], outcomes: readonly (0 | 1)[], nEff = predictions.length): ScoreArtifact {
  if (predictions.length !== outcomes.length || predictions.length === 0) throw new RangeError("predictions and outcomes must have equal non-zero length");
  const scores = predictions.map((p, i) => brierBinary(p, outcomes[i]!));
  const baseRate = binaryBaseline(outcomes);
  const baselineScore = outcomes.reduce((sum: number, outcome) => sum + (baseRate - outcome) ** 2, 0) / outcomes.length;
  const score = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { score, baseline: baselineScore, gain: baselineScore - score, n: scores.length, nEff, margin: normalMargin(scores), state: worldState(nEff), algorithmVersion: WORLD_ALGORITHM_VERSION, parameters: { outcomeModel: "binary", baseline: "empirical-climatology" } };
}

export interface TimedObservation { value: number; observedAt: Date | string; clusterId: string; }

export function temporalWeight(observedAt: Date | string, asOf: Date | string): number {
  const deltaDays = Math.max(0, (new Date(asOf).getTime() - new Date(observedAt).getTime()) / 86_400_000);
  return Math.exp(-LAMBDA * deltaDays);
}

/** Candidate cluster policy. It is versioned and never implies independence. */
export function clusterEffectiveSize(observations: readonly TimedObservation[], asOf: Date | string): { nEff: number; clusterWeights: Record<string, number>; observationWeights: number[] } {
  if (observations.length === 0) return { nEff: 0, clusterWeights: {}, observationWeights: [] };
  const byCluster = new Map<string, TimedObservation[]>();
  for (const observation of observations) { if (!observation.clusterId) throw new RangeError("clusterId is required"); const group = byCluster.get(observation.clusterId) ?? []; group.push(observation); byCluster.set(observation.clusterId, group); }
  const clusterWeights: Record<string, number> = {};
  const observationWeights: number[] = [];
  for (const [cluster, group] of byCluster) {
    const weights = group.map((item) => temporalWeight(item.observedAt, asOf));
    const total = weights.reduce((a, b) => a + b, 0);
    for (const weight of weights) observationWeights.push(weight / total);
    clusterWeights[cluster] = total / group.length;
  }
  const weights = Object.values(clusterWeights);
  const sum = weights.reduce((a, b) => a + b, 0);
  return { nEff: sum === 0 ? 0 : (sum ** 2) / weights.reduce((a, b) => a + b ** 2, 0), clusterWeights, observationWeights };
}

export interface ConsensusInput { predictorId: string; probability: number; }
export function consensusLeaveOneOut(inputs: readonly ConsensusInput[], excludedPredictorId?: string): number | null {
  const usable = inputs.filter((input) => input.predictorId !== excludedPredictorId);
  if (usable.length < QUORUM) return null;
  const logits = usable.map((input) => { const p = clipProbability(input.probability); return Math.log(p / (1 - p)); });
  const mean = logits.reduce((a, b) => a + b, 0) / logits.length;
  return clipProbability(1 / (1 + Math.exp(-mean)));
}

export interface RadarPair { predictorId: string; targetId: string; predicted: number; actual: number; weight?: number; }
export interface RadarArtifact { da: number | null; alpha: number; beta: number; gamma: number; gammaCi95: [number, number] | null; nEff: number; state: EvidenceState; rA: number; rB: number; algorithmVersion: string; parameters: Record<string, number | string>; }

function weightedMean(values: readonly number[], weights: readonly number[]): number { const total = weights.reduce((a, b) => a + b, 0); return values.reduce((sum, value, i) => sum + value * weights[i]!, 0) / total; }
function correlation(x: readonly number[], y: readonly number[], weights: readonly number[]): number | null { if (x.length < 4) return null; const mx = weightedMean(x, weights); const my = weightedMean(y, weights); const cov = x.reduce((s, v, i) => s + weights[i]! * (v - mx) * (y[i]! - my), 0); const vx = x.reduce((s, v, i) => s + weights[i]! * (v - mx) ** 2, 0); const vy = y.reduce((s, v, i) => s + weights[i]! * (v - my) ** 2, 0); return vx <= EPSILON || vy <= EPSILON ? null : cov / Math.sqrt(vx * vy); }

/** Internal Radar estimate. gamma is exclusively the directed pair effect. */
export function estimateRadar(pairs: readonly RadarPair[], tauSquared = 0.04): RadarArtifact {
  if (tauSquared < 0 || !Number.isFinite(tauSquared)) throw new RangeError("tauSquared must be non-negative");
  if (pairs.length === 0) return { da: null, alpha: 0, beta: 0, gamma: 0, gammaCi95: null, nEff: 0, state: "INITIAL", rA: 0, rB: 0, algorithmVersion: RADAR_ALGORITHM_VERSION, parameters: { tauSquared, epsilon: 1e-6 } };
  const weights = pairs.map((pair) => pair.weight ?? 1); if (weights.some((w) => w <= 0 || !Number.isFinite(w))) throw new RangeError("weights must be positive");
  const p = pairs.map((pair) => probability(pair.predicted, "predicted")); const y = pairs.map((pair) => probability(pair.actual, "actual"));
  const da = correlation(p.map((value) => value - 0.5), y.map((value) => value - 0.5), weights);
  const nEff = weights.reduce((a, b) => a + b, 0) ** 2 / weights.reduce((a, b) => a + b ** 2, 0);
  const meanResidual = weightedMean(y.map((value, i) => value - p[i]!), weights);
  const byPredictor = new Map<string, number[]>(); const byTarget = new Map<string, number[]>();
  for (const pair of pairs) { const residual = pair.actual - pair.predicted; (byPredictor.get(pair.predictorId) ?? (byPredictor.set(pair.predictorId, []), byPredictor.get(pair.predictorId)!)).push(residual); (byTarget.get(pair.targetId) ?? (byTarget.set(pair.targetId, []), byTarget.get(pair.targetId)!)).push(residual); }
  const alpha = (byPredictor.get(pairs[0]!.predictorId) ?? [0]).reduce((a, b) => a + b, 0) / (byPredictor.get(pairs[0]!.predictorId)?.length || 1) - meanResidual;
  const beta = (byTarget.get(pairs[0]!.targetId) ?? [0]).reduce((a, b) => a + b, 0) / (byTarget.get(pairs[0]!.targetId)?.length || 1) - meanResidual;
  const rawGamma = meanResidual - alpha - beta;
  const variance = 1 / Math.max(1, nEff - 3); const shrinkage = tauSquared / (tauSquared + variance); const gamma = rawGamma * shrinkage;
  const se = Math.sqrt(Math.max(EPSILON, variance * shrinkage)); const ci: [number, number] = [gamma - 1.96 * se, gamma + 1.96 * se];
  const rA = new Set(pairs.map((pair) => pair.predictorId)).size; const rB = new Set(pairs.map((pair) => pair.targetId)).size;
  return { da, alpha, beta, gamma, gammaCi95: ci, nEff, state: radarState(nEff, rA, rB, ci[0] > 0 || ci[1] < 0), rA, rB, algorithmVersion: RADAR_ALGORITHM_VERSION, parameters: { tauSquared, shrinkage, lambda: LAMBDA, timeWeightVersion: TIME_WEIGHT_VERSION, clusterVersion: CLUSTER_ALGORITHM_VERSION } };
}

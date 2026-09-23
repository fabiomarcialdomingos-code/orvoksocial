import { describe, expect, it } from "vitest";
import { brierBinary, brierMulticlass, baselineBrier, clipProbability, confidenceInterval95, effectiveSampleSize, leaveOneOutConsensus, pooledConsensus, radarEvidenceState, shrink, temporalWeights, worldEvidenceState } from "@/lib/math/engine";

describe("internal math engine V1", () => {
  it("calculates binary and multiclass Brier deterministically", () => {
    expect(brierBinary(0.8, 1)).toBeCloseTo(0.04);
    expect(brierMulticlass([0.7, 0.2, 0.1], 0)).toBeCloseTo(0.14);
    expect(baselineBrier([0, 1, 1, 0])).toBeCloseTo(0.25);
  });
  it("clips consensus inputs and excludes the forecaster", () => {
    expect(clipProbability(0)).toBe(0.05);
    expect(pooledConsensus([0.8, 0.2])).toBeCloseTo(0.5);
    expect(leaveOneOutConsensus([0.9, 0.5, 0.1], 0)).toBeCloseTo(0.3, 1);
  });
  it("normalizes temporal weights and computes n_eff", () => {
    const weights = temporalWeights([0, 5], 5, 0.1);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(effectiveSampleSize([0.5, 0.5])).toBeCloseTo(2);
  });
  it("keeps shrinkage and intervals explicit", () => {
    expect(shrink(0.9, 0.5, 1, 1)).toBeCloseTo(0.7);
    const interval = confidenceInterval95([0.2, 0.4, 0.6]);
    expect(interval.lower).toBeLessThan(interval.estimate);
    expect(interval.upper).toBeGreaterThan(interval.estimate);
  });
  it("applies canonical evidence thresholds", () => {
    expect(worldEvidenceState(0)).toBe("INITIAL");
    expect(worldEvidenceState(96)).toBe("EVALUATION");
    expect(worldEvidenceState(97)).toBe("SUFFICIENT");
    expect(radarEvidenceState(43, 10, 10, { lower: 1, upper: 2 })).toBe("INITIAL");
    expect(radarEvidenceState(90, 10, 10, { lower: 0.1, upper: 2 })).toBe("SUFFICIENT");
    expect(radarEvidenceState(90, 10, 10, { lower: -1, upper: 1 })).toBe("EVALUATION");
  });
});

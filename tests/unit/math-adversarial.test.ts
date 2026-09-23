import { describe, expect, it } from "vitest";
import { brierBinary, confidenceInterval95, effectiveSampleSize, leaveOneOutConsensus, pooledConsensus, radarEvidenceState, temporalWeights, worldEvidenceState } from "@/lib/math/engine";

describe("independent adversarial audit of mathematical primitives", () => {
  it("does not allow a forecast to become its own leave-one-out reference", () => {
    const forecasts = [0.05, 0.95, 0.95, 0.05, 0.95];
    const reference = leaveOneOutConsensus(forecasts, 0);
    expect(reference).toBeCloseTo(pooledConsensus(forecasts.slice(1)));
    expect(reference).not.toBeCloseTo(pooledConsensus(forecasts));
  });

  it("keeps consensus bounded under extreme but valid inputs", () => {
    expect(pooledConsensus([0, 0, 0])).toBeCloseTo(0.05);
    expect(pooledConsensus([1, 1, 1])).toBeCloseTo(0.95);
    expect(() => pooledConsensus([])).toThrow();
  });

  it("preserves evidence threshold boundaries exactly", () => {
    expect(worldEvidenceState(0)).toBe("INITIAL");
    expect(worldEvidenceState(96.999999)).toBe("EVALUATION");
    expect(worldEvidenceState(97)).toBe("SUFFICIENT");
    expect(radarEvidenceState(44, 10, 10, { lower: -0.01, upper: 0.01 })).toBe("EVALUATION");
    expect(radarEvidenceState(90, 10, 10, { lower: 0.000001, upper: 0.2 })).toBe("SUFFICIENT");
  });

  it("is deterministic under a seeded Monte Carlo stream and has finite outputs", () => {
    let seed = 0x12345678;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const values: number[] = [];
    for (let i = 0; i < 2000; i++) values.push(pooledConsensus(Array.from({ length: 5 }, () => random())));
    expect(values.every(Number.isFinite)).toBe(true);
    expect(values.every((value) => value >= 0.05 && value <= 0.95)).toBe(true);
    expect(values.reduce((a, b) => a + b, 0) / values.length).toBeCloseTo(0.5, 1);
  });

  it("keeps Brier, intervals, and n_eff finite for edge fixtures", () => {
    expect(brierBinary(0, 1)).toBe(1);
    expect(brierBinary(1, 0)).toBe(1);
    expect(confidenceInterval95([0.5]).margin).toBe(0);
    expect(effectiveSampleSize([1, 1, 1])).toBe(3);
    expect(() => brierBinary(Number.NaN, 0)).toThrow();
  });

  it("rejects invalid temporal decay instead of silently changing the dataset", () => {
    expect(() => temporalWeights([0, 1], 2, -1)).toThrow();
  });
});

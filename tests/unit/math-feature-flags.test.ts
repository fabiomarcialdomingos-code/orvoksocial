import { describe, expect, it } from "vitest";
import {
  assertMathCalculationEnvironment,
  assertMathPublicationDisabled,
  isInternalMathCalculationEnabled,
  isMathPublicationEnabled,
  parseMathFeatureFlags,
} from "@/lib/math-feature-flags";

describe("mathematical engine publication gates", () => {
  it("keeps every publication gate closed by default", () => {
    const flags = parseMathFeatureFlags({});
    expect(flags).toEqual({
      MATH_ENGINE_ENABLED: false,
      SCORE_PUBLICATION_ENABLED: false,
      RADAR_SCORE_PUBLICATION_ENABLED: false,
      RANKING_ENABLED: false,
      MATHEMATICAL_REPUTATION_ENABLED: false,
      OFFICIAL_RADAR_CATALOG_ENABLED: false,
      REAL_USER_HOMOLOGATION_ENABLED: false,
    });
    expect(isMathPublicationEnabled(flags)).toBe(false);
  });

  it("rejects a configuration that opens a publication gate", () => {
    const flags = parseMathFeatureFlags({ SCORE_PUBLICATION_ENABLED: "true" });
    expect(() => assertMathPublicationDisabled(flags)).toThrow(
      "ORVOK_MATH_PUBLICATION_GATE_REQUIRES_FORMAL_RELEASE",
    );
  });

  it("allows private engine calculations while publication remains closed", () => {
    const flags = parseMathFeatureFlags({ MATH_ENGINE_ENABLED: "true" });
    expect(flags.MATH_ENGINE_ENABLED).toBe(true);
    expect(isMathPublicationEnabled(flags)).toBe(false);
  });

  it("allows internal calculation only in controlled environments", () => {
    const enabled = parseMathFeatureFlags({ MATH_ENGINE_ENABLED: "true" });
    expect(isInternalMathCalculationEnabled("development", enabled)).toBe(true);
    expect(isInternalMathCalculationEnabled("test", enabled)).toBe(true);
    expect(isInternalMathCalculationEnabled("staging", enabled)).toBe(true);
    expect(() => assertMathCalculationEnvironment("production", enabled)).toThrow(
      "ORVOK_MATH_ENGINE_PRODUCTION_DISABLED",
    );
  });
});

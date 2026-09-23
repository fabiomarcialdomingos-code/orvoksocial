import { z } from "zod";

const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

/**
 * Publication and product gates for the mathematical engine.
 *
 * All gates are closed by default. The engine may persist private,
 * versioned calculations when MATH_ENGINE_ENABLED is enabled, but no
 * user-facing metric can be exposed until its independent publication gate
 * is explicitly opened through a reviewed deployment configuration.
 */
export const mathFeatureFlagSchema = z.object({
  MATH_ENGINE_ENABLED: flag,
  SCORE_PUBLICATION_ENABLED: flag,
  RADAR_SCORE_PUBLICATION_ENABLED: flag,
  RANKING_ENABLED: flag,
  MATHEMATICAL_REPUTATION_ENABLED: flag,
  OFFICIAL_RADAR_CATALOG_ENABLED: flag,
  REAL_USER_HOMOLOGATION_ENABLED: flag,
});

export type MathFeatureFlags = z.infer<typeof mathFeatureFlagSchema>;

export function parseMathFeatureFlags(
  input: Record<string, unknown> = process.env,
): MathFeatureFlags {
  return mathFeatureFlagSchema.parse(input);
}

export function assertMathPublicationDisabled(flags = parseMathFeatureFlags()): void {
  if (
    flags.SCORE_PUBLICATION_ENABLED ||
    flags.RADAR_SCORE_PUBLICATION_ENABLED ||
    flags.RANKING_ENABLED ||
    flags.MATHEMATICAL_REPUTATION_ENABLED ||
    flags.OFFICIAL_RADAR_CATALOG_ENABLED ||
    flags.REAL_USER_HOMOLOGATION_ENABLED
  ) {
    throw new Error("ORVOK_MATH_PUBLICATION_GATE_REQUIRES_FORMAL_RELEASE");
  }
}

export function isMathPublicationEnabled(flags = parseMathFeatureFlags()): false {
  assertMathPublicationDisabled(flags);
  return false;
}

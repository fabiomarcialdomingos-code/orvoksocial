import {
  assertMathPublicationDisabled as assertConfiguredPublicationDisabled,
  parseMathFeatureFlags,
} from "../math-feature-flags";

export const MATH_FEATURE_FLAGS = Object.freeze({
  internalCalculation: parseMathFeatureFlags().MATH_ENGINE_ENABLED,
  publishScore: false,
  publishRadarScore: false,
  ranking: false,
  reputation: false,
} as const);

/** Deliberately refuses every publication call while the release gates are closed. */
export function assertMathPublicationDisabled(): never {
  assertConfiguredPublicationDisabled();
  throw new Error("MATH_PUBLICATION_DISABLED");
}

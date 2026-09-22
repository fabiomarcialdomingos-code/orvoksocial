import { describe, expect, it } from "vitest";
import {
  isPredictionBeforeOutcome,
  isRadarOrderValid,
} from "../../src/lib/radar-temporal";

const at = (second: number) => new Date(1_700_000_000_000 + second * 1_000);

describe("ordem temporal", () => {
  it("exige convite, aceite, grant, gabarito e previsão em ordem estrita", () => {
    const valid = {
      invitedAt: at(1),
      acceptedAt: at(2),
      grantedAt: at(3),
      answeredAt: at(4),
      predictedAt: at(5),
    };
    expect(isRadarOrderValid(valid)).toBe(true);
    for (const key of [
      "acceptedAt",
      "grantedAt",
      "answeredAt",
      "predictedAt",
    ] as const) {
      const invalid = { ...valid, [key]: at(1) };
      expect(isRadarOrderValid(invalid)).toBe(false);
    }
    expect(isRadarOrderValid({ ...valid, acceptedAt: valid.invitedAt })).toBe(
      false,
    );
  });

  it("reserva previsão antes do resultado para fluxos de desfecho posterior", () => {
    expect(isPredictionBeforeOutcome(at(1), at(2))).toBe(true);
    expect(isPredictionBeforeOutcome(at(2), at(2))).toBe(false);
    expect(isPredictionBeforeOutcome(at(3), at(2))).toBe(false);
  });
});

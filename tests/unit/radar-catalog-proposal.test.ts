import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Radar candidata V1", () => {
  it("contains exactly 12 ordered proposal questions with four options", async () => {
    const manifest = JSON.parse(await readFile("fixtures/radar-base-candidata-v1.json", "utf8")) as {
      instrumentVersion: string; status: string; language: string; responseType: string;
      sensitivity: string; questions: Array<{ stableKey: string; version: number; familyKey: string; options: unknown[] }>;
    };
    expect(manifest.instrumentVersion).toBe("RADAR_BASE_CANDIDATA_V1");
    expect(manifest.status).toBe("PROPOSTA_PARA_APROVACAO");
    expect(manifest.language).toBe("pt-BR");
    expect(manifest.responseType).toBe("SINGLE_CHOICE");
    expect(manifest.sensitivity).toBe("LOW");
    expect(manifest.questions).toHaveLength(12);
    expect(manifest.questions.map((question) => question.stableKey)).toEqual(
      Array.from({ length: 12 }, (_, index) => `Q${String(index + 1).padStart(2, "0")}`),
    );
    expect(manifest.questions.every((question) => question.version === 1 && question.options.length === 4)).toBe(true);
    expect(new Set(manifest.questions.map((question) => question.familyKey)).size).toBe(12);
  });
});

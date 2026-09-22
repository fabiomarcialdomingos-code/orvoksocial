import { describe, expect, it } from "vitest";
import { parseServerEnv } from "../../src/lib/env";

describe("server environment", () => {
  it("accepts a PostgreSQL URL without needing a live secret", () => {
    const value = parseServerEnv({
      APP_ENV: "test",
      DATABASE_URL: "postgresql://user:password@127.0.0.1:5432/orvok_test",
    });
    expect(value.APP_ENV).toBe("test");
  });

  it("rejects non-PostgreSQL URLs", () => {
    expect(() =>
      parseServerEnv({
        APP_ENV: "test",
        DATABASE_URL: "https://example.invalid",
      }),
    ).toThrow();
  });
});

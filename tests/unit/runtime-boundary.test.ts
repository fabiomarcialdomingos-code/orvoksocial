import { describe, expect, it } from "vitest";
import { assertRuntimeDatabaseBoundary } from "../../src/lib/runtime-boundary";

describe("database runtime boundary", () => {
  it("rejects owner URLs in staging and production", () => {
    for (const APP_ENV of ["staging", "production"])
      expect(() => assertRuntimeDatabaseBoundary({
        APP_ENV,
        DATABASE_URL: "postgresql://owner@localhost/db",
        APP_DATABASE_URL: "postgresql://app@localhost/db",
        AUTH_DATABASE_URL: "postgresql://auth@localhost/db",
      })).toThrow("OWNER_DATABASE_CREDENTIAL_IN_RUNTIME");
  });

  it("requires both limited roles and permits offline test tooling", () => {
    expect(() => assertRuntimeDatabaseBoundary({ APP_ENV: "production" })).toThrow("RUNTIME_DATABASE_CREDENTIALS_REQUIRED");
    expect(() => assertRuntimeDatabaseBoundary({ APP_ENV: "staging", APP_DATABASE_URL: "app", AUTH_DATABASE_URL: "auth" })).not.toThrow();
    expect(() => assertRuntimeDatabaseBoundary({ APP_ENV: "test", DATABASE_URL: "owner" })).not.toThrow();
  });
});

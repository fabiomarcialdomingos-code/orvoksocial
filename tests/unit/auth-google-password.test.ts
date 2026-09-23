import { afterEach, describe, expect, it } from "vitest";
import { googleStartResponse } from "@/lib/auth/google";
import { PASSWORD_POLICY_MESSAGE, registrationSchema, resetSchema } from "@/lib/auth/service";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });

describe("política de senha", () => {
  it.each(["abcDEF!", "abcdefgh!", "ABCDEFGH!", "Abcdefgh"]) ("rejeita senha inválida: %s", (password) => {
    const result = registrationSchema.safeParse({ email: "test@example.com", password });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.message === PASSWORD_POLICY_MESSAGE)).toBe(true);
  });
  it("aceita oito caracteres com os três requisitos", () => {
    expect(registrationSchema.safeParse({ email: "test@example.com", password: "Abcdef1!" }).success).toBe(true);
    expect(resetSchema.safeParse({ token: "a".repeat(43), password: "Abcdef1!" }).success).toBe(true);
  });
});

describe("início OAuth Google", () => {
  it("emite redirect e cookie HttpOnly com state e nonce", () => {
    process.env.AUTH_SECRET = "a".repeat(32);
    process.env.GOOGLE_CLIENT_ID = "client-test";
    process.env.GOOGLE_CLIENT_SECRET = "secret-test";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/v1/auth/google/callback";
    const response = googleStartResponse("/convites");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("accounts.google.com");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
  });
});

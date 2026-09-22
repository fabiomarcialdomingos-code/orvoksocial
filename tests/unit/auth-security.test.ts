import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decryptMailPayload,
  encryptMailPayload,
  hashPassword,
  tokenHash,
  verifyPassword,
} from "../../src/lib/auth/crypto";
import { assertMutationRequest, AuthError } from "../../src/lib/auth/session";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.AUTH_MAIL_KEY = randomBytes(32).toString("hex");
  process.env.APP_ORIGIN = "https://orvok.test";
});

describe("autenticação: primitivas de segurança", () => {
  it("hash de senha tem sal aleatório e comparação resistente a tempo", async () => {
    const a = await hashPassword("Uma senha longa 12345!");
    const b = await hashPassword("Uma senha longa 12345!");
    expect(a).not.toBe(b);
    expect(await verifyPassword("Uma senha longa 12345!", a)).toBe(true);
    expect(await verifyPassword("outra senha longa", a)).toBe(false);
  });

  it("HMAC não revela token e payload da fila exige chave", () => {
    const token = "x".repeat(43);
    expect(tokenHash(token)).not.toContain(token);
    const encrypted = encryptMailPayload({ token, email: "a@example.test" });
    expect(encrypted).not.toContain(token);
    expect(decryptMailPayload<{ token: string }>(encrypted).token).toBe(token);
    const [nonce, tag, ciphertext] = encrypted.split(".");
    const alteredTag = `${tag![0] === "A" ? "B" : "A"}${tag!.slice(1)}`;
    expect(() => decryptMailPayload(`${nonce}.${alteredTag}.${ciphertext}`)).toThrow();
  });

  it("rejeita mutação cross-origin, sem Origin, formulário e fetch cross-site", () => {
    const request = (origin: string | null, type = "application/json", site?: string) => {
      const headers: Record<string, string> = { "content-type": type };
      if (origin) headers.origin = origin;
      if (site) headers["sec-fetch-site"] = site;
      return new Request("https://orvok.test/api/v1/auth/login", { method: "POST", headers, body: "{}" });
    };
    expect(() => assertMutationRequest(request("https://orvok.test"))).not.toThrow();
    for (const bad of [request(null), request("https://evil.test"), request("https://orvok.test", "text/plain"), request("https://orvok.test", "application/json", "cross-site")]) {
      expect(() => assertMutationRequest(bad)).toThrow(AuthError);
    }
  });
});

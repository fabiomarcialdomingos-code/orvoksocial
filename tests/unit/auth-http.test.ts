import { describe, expect, it } from "vitest";
import { authEndpoint } from "../../src/lib/auth/http";

const endpoint = "https://orvok.test/api/v1/auth/login";
function request(body: string, headers: Record<string, string> = {}) {
  return new Request(endpoint, {
    method: "POST",
    headers: { origin: "https://orvok.test", "content-type": "application/json", ...headers },
    body,
  });
}

describe("envelope HTTP de autenticação", () => {
  it("aceita JSON válido sem cache", async () => {
    const response = await authEndpoint(request("{}"), async () => Response.json({ ok: true }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("bloqueia corpo grande mesmo sem Content-Length confiável", async () => {
    const response = await authEndpoint(request(JSON.stringify({ filler: "x".repeat(20_000) })), async () => Response.json({ ok: true }));
    expect(response.status).toBe(413);
  });
  it("rejeita JSON inválido sem refletir corpo", async () => {
    const response = await authEndpoint(request("{not-json"), async () => Response.json({ ok: true }));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("not-json");
  });
});

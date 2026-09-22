import { describe, expect, it } from "vitest";
import { canAccess, type AccessRequest } from "../../src/lib/access-control";

const base: AccessRequest = {
  role: "USER",
  actorId: "predictor",
  resource: "RADAR_SNAPSHOT",
  action: "READ",
  predictorId: "predictor",
  targetId: "target",
  visibility: "SHARED",
  consentActive: true,
};

describe("matriz de autorização sem publicação pública", () => {
  it("permite apenas participantes de snapshot compartilhado com consentimento ativo", () => {
    expect(canAccess(base)).toBe(true);
    expect(canAccess({ ...base, actorId: "target" })).toBe(true);
    expect(canAccess({ ...base, actorId: "third" })).toBe(false);
    expect(canAccess({ ...base, actorId: "target", consentActive: false })).toBe(false);
    expect(canAccess({ ...base, actorId: "target", visibility: "PRIVATE" })).toBe(false);
  });

  it("não concede gabarito privado a administrador ou moderador", () => {
    for (const role of ["ADMIN", "MODERATOR", "USER"] as const) {
      expect(canAccess({ role, actorId: "third", resource: "RADAR_ANSWER", action: "READ", ownerId: "target" })).toBe(false);
    }
    expect(canAccess({ role: "USER", actorId: "target", resource: "RADAR_ANSWER", action: "READ", ownerId: "target" })).toBe(true);
  });

  it("restringe auditoria, moderação, notificações e pedidos de dados", () => {
    expect(canAccess({ role: "ADMIN", actorId: "admin", resource: "AUDIT", action: "READ" })).toBe(true);
    expect(canAccess({ role: "MODERATOR", actorId: "mod", resource: "AUDIT", action: "READ" })).toBe(false);
    expect(canAccess({ role: "MODERATOR", actorId: "mod", resource: "MODERATION", action: "READ" })).toBe(true);
    expect(canAccess({ role: "MODERATOR", actorId: "mod", resource: "MODERATION", action: "DELETE" })).toBe(false);
    expect(canAccess({ role: "USER", actorId: "other", resource: "DATA_REQUEST", action: "READ", ownerId: "target" })).toBe(false);
    expect(canAccess({ role: "USER", actorId: "target", resource: "NOTIFICATION", action: "READ", recipientId: "target" })).toBe(true);
  });

  it("bloqueia publicação e anonimização não verificada", () => {
    expect(canAccess({ role: "USER", actorId: "any", resource: "PUBLIC_CONTENT", action: "READ" })).toBe(false);
    expect(canAccess({ role: "USER", actorId: "any", resource: "ANONYMIZED_AGGREGATE", action: "READ" })).toBe(false);
    expect(canAccess({ role: "USER", actorId: "any", resource: "ANONYMIZED_AGGREGATE", action: "READ", anonymizationVerified: true })).toBe(true);
  });
});

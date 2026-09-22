import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { randomToken, tokenHash } from "../../src/lib/auth/crypto";
import { GET, POST } from "../../src/app/api/v1/[[...path]]/route";
import { enforceOperationalRateLimit, OPERATIONAL_RATE_LIMIT_VERSION } from "../../src/lib/api/rate-limit";
import { DataRightsService } from "../../src/lib/api/data-rights";
import { operationalPool } from "../../src/lib/api/operational-db";

const url = process.env.DATABASE_URL;
describe.skipIf(!url)("contratos operacionais /api/v1", () => {
  const pool = new Pool({ connectionString: url });
  const owner = randomUUID();
  const stranger = randomUUID();
  const sessionId = randomUUID();
  const token = randomToken();
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  const requestIds: string[] = [];

  function request(path: string, method: "GET" | "POST", body?: unknown, authenticated = true, originHeader = origin) {
    return new Request(`${origin}/api/v1/${path}`, {
      method,
      headers: {
        ...(authenticated ? { cookie: `orvok_session=${token}` } : {}),
        ...(method === "POST" ? { origin: originHeader, "content-type": "application/json", "Idempotency-Key": `fixture-${randomUUID()}` } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  }
  const context = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "fixture-auth-secret-minimum-thirty-two-characters";
    await pool.query(`INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp()),($2,clock_timestamp())`, [owner, stranger]);
    await pool.query(`INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt") VALUES ($1,$3,'FIXTURE_ONLY',clock_timestamp()),($2,$4,'FIXTURE_ONLY',clock_timestamp())`, [owner, stranger, `owner-${owner}@example.invalid`, `stranger-${stranger}@example.invalid`]);
    await pool.query(`INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt") VALUES ($1,$2,$3,$4,clock_timestamp()+interval '1 hour')`, [sessionId, owner, tokenHash(token), randomUUID()]);
  });
  afterAll(async () => {
    await pool.query(`DELETE FROM "AuditLog" WHERE "actorId"=ANY($1::uuid[])`, [[owner, stranger]]);
    await pool.query(`DELETE FROM "DataRequest" WHERE "subjectId"=ANY($1::uuid[])`, [[owner, stranger]]);
    await pool.query(`DELETE FROM "ApiIdempotency" WHERE "actorId"=ANY($1::uuid[])`, [[owner, stranger]]);
    await pool.query(`DELETE FROM "AuthRateLimit" WHERE "keyHash"=$1`, [createHash("sha256").update(`${OPERATIONAL_RATE_LIMIT_VERSION}:${owner}:/fixture/rate`).digest("hex")]);
    await pool.query(`DELETE FROM "AuthSession" WHERE id=$1`, [sessionId]);
    await pool.query(`DELETE FROM "AuthIdentity" WHERE "userId"=ANY($1::uuid[])`, [[owner, stranger]]);
    await pool.query(`DELETE FROM "User" WHERE id=ANY($1::uuid[])`, [[owner, stranger]]);
    await pool.end();
  });

  it("nega leitura sem sessão e permite perfil somente do titular", async () => {
    const denied = await GET(request("users/me", "GET", undefined, false), context("users/me"));
    expect(denied.status).toBe(401);
    const own = await GET(request("users/me", "GET"), context("users/me"));
    expect(own.status).toBe(200);
    const json = await own.json();
    expect(json.user.id).toBe(owner);
    expect(JSON.stringify(json)).not.toContain("passwordHash");
  });

  it("bloqueia Origin externo e registra tentativa autenticada", async () => {
    const denied = await POST(request("me/erasure-requests", "POST", {}, true, "https://attacker.invalid"), context("me/erasure-requests"));
    expect(denied.status).toBe(403);
    const count = await pool.query(`SELECT count(*)::integer AS n FROM "DataRequest" WHERE "subjectId"=$1`, [owner]);
    expect(count.rows[0]?.n).toBe(0);
    const audit = await pool.query(`SELECT 1 FROM "AuditLog" WHERE "actorId"=$1 AND action='API_MUTATION_BLOCKED'`, [owner]);
    expect(audit.rowCount).toBeGreaterThan(0);
  });

  it("não aceita aviso forjado nem ator declarado no corpo", async () => {
    const prematureNotice = await GET(
      request("consent-notice?purpose=BE_PREDICTED", "GET"),
      context("consent-notice"),
    );
    expect(prematureNotice.status).toBe(400);
    const consent = await POST(
      request("radar/consents", "POST", {
        acceptanceId: randomUUID(), presentationId: randomUUID(), accepted: true,
        noticeVersion: "UNAPPROVED_FIXTURE", noticeHash: "f".repeat(64), scope: "SHARED",
      }),
      context("radar/consents"),
    );
    expect(consent.status).toBe(422);
    const impersonation = await POST(
      request("radar/invitations", "POST", { targetId: stranger, predictorId: stranger }),
      context("radar/invitations"),
    );
    expect(impersonation.status).toBe(400);
    const invitations = await pool.query(`SELECT 1 FROM "RadarInvitation" WHERE "predictorId"=$1`, [stranger]);
    expect(invitations.rowCount).toBe(0);
  });

  it("recusa corpo acima de 64 KiB antes da operação", async () => {
    const oversized = await POST(
      request("radar/invitations", "POST", { targetId: stranger, padding: "x".repeat(70_000) }),
      context("radar/invitations"),
    );
    expect(oversized.status).toBe(413);
    const count = await pool.query(`SELECT 1 FROM "RadarInvitation" WHERE "predictorId"=$1`, [owner]);
    expect(count.rowCount).toBe(0);
  });

  it("cria pedido técnico de exclusão sem apagar dados e repete resposta idempotente", async () => {
    const key = `fixture-${randomUUID()}`;
    const firstRequest = request("me/erasure-requests", "POST");
    firstRequest.headers.set("Idempotency-Key", key);
    const first = await POST(firstRequest, context("me/erasure-requests"));
    expect(first.status).toBe(202);
    const firstJson = await first.json();
    requestIds.push(firstJson.requestId);
    const repeat = request("me/erasure-requests", "POST");
    repeat.headers.set("Idempotency-Key", key);
    const second = await POST(repeat, context("me/erasure-requests"));
    expect(second.status).toBe(202);
    expect((await second.json()).requestId).toBe(firstJson.requestId);
    const record = await pool.query(`SELECT status FROM "DataRequest" WHERE id=$1 AND "subjectId"=$2`, [firstJson.requestId, owner]);
    expect(record.rows[0]?.status).toBe("RECEIVED");
    const stillExists = await pool.query(`SELECT 1 FROM "User" WHERE id=$1`, [owner]);
    expect(stillExists.rowCount).toBe(1);
  });

  it("não expõe dados de terceiros na exportação ou inbox", async () => {
    const exportResponse = await GET(request("me/export", "GET"), context("me/export"));
    expect(exportResponse.status).toBe(200);
    const exportJson = await exportResponse.json();
    expect(exportJson.export.profile.id).toBe(owner);
    expect(JSON.stringify(exportJson)).not.toContain(stranger);
    const inbox = await GET(request("notifications", "GET"), context("notifications"));
    expect(inbox.status).toBe(200);
    expect((await inbox.json()).items).toEqual([]);
  });

  it("limita mutações por ator e rota com parâmetro operacional configurável", async () => {
    const prior = process.env.ORVOK_API_MUTATION_RATE_PER_MIN;
    process.env.ORVOK_API_MUTATION_RATE_PER_MIN = "2";
    try {
      const scoped = operationalPool(tokenHash(token));
      await enforceOperationalRateLimit(scoped, "/fixture/rate");
      await enforceOperationalRateLimit(scoped, "/fixture/rate");
      await expect(enforceOperationalRateLimit(scoped, "/fixture/rate")).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
    } finally {
      if (prior === undefined) delete process.env.ORVOK_API_MUTATION_RATE_PER_MIN;
      else process.env.ORVOK_API_MUTATION_RATE_PER_MIN = prior;
    }
  });

  it("exporta volume em lotes sem truncar a página 100/200", async () => {
    const identifiers = Array.from({ length: 205 }, () => randomUUID());
    await pool.query(
      `INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt") SELECT x.id,$1,'FIXTURE_VOLUME','User',$1,clock_timestamp() FROM unnest($2::uuid[]) AS x(id)`,
      [owner, identifiers],
    );
    const response = await GET(request("me/export", "GET"), context("me/export"));
    expect(response.status).toBe(200);
    const json = await response.json();
    const exported = new Set(json.export.auditActions.map((item: { id: string }) => item.id));
    expect(identifiers.every((id) => exported.has(id))).toBe(true);
  });

  it("exports paralelos não bloqueiam pool e cancelamento sem leitura libera cliente", async () => {
    const parallel = await Promise.all(Array.from({ length: 12 }, async () => {
      const response = await GET(request("me/export", "GET"), context("me/export"));
      expect(response.status).toBe(200);
      return response.json();
    }));
    expect(parallel.every((data) => data.export.profile.id === owner)).toBe(true);
    const isolated = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 1000 });
    const controller = new AbortController();
    try {
      const response = await new DataRightsService(isolated).streamOwnData(owner, controller.signal);
      expect(response.status).toBe(200);
      controller.abort();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const free = await isolated.query(`SELECT 1`);
      expect(free.rows[0]).toEqual({ "?column?": 1 });
    } finally {
      await isolated.end();
    }
  });
});

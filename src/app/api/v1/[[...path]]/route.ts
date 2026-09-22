import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { canAccess } from "@/lib/access-control";
import { assertMutationRequest, readSessionCookie, requirePrincipal } from "@/lib/auth/session";
import { tokenHash } from "@/lib/auth/crypto";
import { DataRightsService } from "@/lib/api/data-rights";
import { withIdempotency } from "@/lib/api/idempotency";
import { operationalPool } from "@/lib/api/operational-db";
import { RadarOperations } from "@/lib/api/radar-operations";
import { RadarRpc } from "@/lib/api/radar-rpc";
import { enforceOperationalRateLimit } from "@/lib/api/rate-limit";
import { apiError, apiJson, OperationalApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.uuid();
const inviteBody = z.strictObject({ targetId: uuid });
const grantBody = z.strictObject({
  acceptanceId: uuid,
  presentationId: uuid,
  accepted: z.literal(true),
  noticeVersion: z.string().min(1).max(80),
  noticeHash: z.string().regex(/^[a-f0-9]{64}$/),
  scope: z.enum(["PRIVATE", "SHARED"]),
});
const predictionBody = z.strictObject({
  targetId: uuid,
  questionVersionId: uuid,
  selfAnswerVersionId: uuid,
  grantId: uuid,
  probabilityVector: z.array(z.number().finite().min(0).max(1)).min(2).max(20),
  supersedesId: uuid.optional(),
});
const answerBody = z.strictObject({
  questionVersionId: uuid,
  optionId: uuid,
  consentGrantId: uuid,
  supersedesId: uuid.optional(),
});

async function readJsonBody(request: Request): Promise<unknown> {
  const maximum = 64 * 1024;
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximum)
    throw new OperationalApiError(413, "PAYLOAD_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("JSON body required");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maximum) throw new OperationalApiError(413, "PAYLOAD_TOO_LARGE");
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new OperationalApiError(400, "VALIDATION_ERROR");
  }
}

function requireAccess(allowed: boolean): void {
  if (!allowed) throw new OperationalApiError(403, "FORBIDDEN");
}

function pageCursor(request: Request) {
  const value = new URL(request.url).searchParams.get("cursor");
  return value ? uuid.parse(Buffer.from(value, "base64url").toString("utf8")) : null;
}

function page<T extends { id: string }>(rows: T[]) {
  const items = rows.slice(0, 20);
  const nextCursor = rows.length > 20 ? Buffer.from(items[19]!.id).toString("base64url") : null;
  return { items, nextCursor };
}

async function handler(request: Request, method: "GET" | "POST", path: string[]) {
  const principal = await requirePrincipal(request);
  if (method === "POST") assertMutationRequest(request);
  const actorId = principal.userId;
  const role = principal.role;
  const sessionToken = readSessionCookie(request);
  if (!sessionToken) throw new OperationalApiError(401, "UNAUTHENTICATED");
  const sessionHash = tokenHash(sessionToken);
  const pool = operationalPool(sessionHash);
  const rpc = new RadarRpc(pool, sessionHash);
  const operations = new RadarOperations(pool);
  const rights = new DataRightsService(pool);
  const route = `/${path.join("/")}`;
  if (method === "POST") await enforceOperationalRateLimit(pool, route);

  const isRevocation = method === "POST" && path.length === 4 && path[0] === "radar" &&
    (path[1] === "consents" || path[1] === "self-answer-consents") && path[3] === "revoke";
  if (!isRevocation && (route.startsWith("/radar/") || route === "/consent-notice")) {
    if (process.env.APP_ENV !== "development" && process.env.APP_ENV !== "test") {
      const material = await pool.query<{ present: boolean }>(`SELECT orvok_catalog_test_material_present() AS present`);
      if (material.rows[0]?.present || process.env.APP_ENV !== "staging" && process.env.APP_ENV !== "production")
        throw new OperationalApiError(503, "TEST_CATALOG_IN_DEPLOYED_ENVIRONMENT");
    }
  }

  if (method === "GET" && route === "/consent-notice") {
    await enforceOperationalRateLimit(pool, route);
    const params = new URL(request.url).searchParams;
    const purpose = z.enum(["SELF_ANSWER", "BE_PREDICTED"]).parse(params.get("purpose"));
    let acceptanceId: string | undefined;
    if (purpose === "BE_PREDICTED") {
      acceptanceId = uuid.parse(params.get("acceptanceId"));
      const accepted = await pool.query(
        `SELECT 1 FROM "RadarInvitationAcceptance" WHERE id=$1 AND "targetId"=$2 AND "acceptedAt"<clock_timestamp()`,
        [acceptanceId, actorId],
      );
      if (!accepted.rowCount) throw new OperationalApiError(404, "NOT_FOUND");
    }
    const notice = await rpc.presentNotice(purpose, acceptanceId);
    return apiJson(notice);
  }
  if (method === "GET" && route === "/users/me") {
    requireAccess(canAccess({ role, actorId, resource: "PROFILE", action: "READ", ownerId: actorId }));
    const result = await pool.query(`SELECT id,status,"createdAt" FROM "User" WHERE id=$1`, [actorId]);
    return apiJson({ user: result.rows[0] ?? null });
  }
  if (method === "GET" && route === "/radar/questions") {
    const cursor = pageCursor(request);
    const rows = await pool.query<{
      questionVersionId: string; version: number; text: string; instrumentVersion: string;
      catalogStatus: string; options: { id: string; label: string; position: number }[];
    }>(`SELECT qv.id AS "questionVersionId",qv.version,qv.text,qv."instrumentVersion",qv."catalogStatus",
      COALESCE(jsonb_agg(jsonb_build_object('id',ao.id,'label',ao.label,'position',ao.position)
        ORDER BY ao.position) FILTER (WHERE ao.id IS NOT NULL),'[]'::jsonb) AS options
      FROM "QuestionVersion" qv JOIN "Question" q ON q.id=qv."questionId"
      LEFT JOIN "AnswerOption" ao ON ao."questionVersionId"=qv.id
      WHERE q.domain='RADAR' AND orvok_catalog_version_enabled(qv.id)
        AND ($1::uuid IS NULL OR qv.id>$1)
      GROUP BY qv.id ORDER BY qv.id LIMIT 21`, [cursor]);
    const items = rows.rows.slice(0, 20);
    const nextCursor = rows.rows.length > 20 && items[19]
      ? Buffer.from(items[19].questionVersionId).toString("base64url") : null;
    return apiJson({ items, nextCursor });
  }
  if (method === "GET" && route === "/radar/answers") {
    const cursor = pageCursor(request);
    const result = await pool.query<{ id: string; questionVersionId: string; optionId: string; version: number; answeredAt: Date }>(
      `SELECT av.id,av."questionVersionId",av."optionId",av.version,av."answeredAt"
        FROM "AnswerVersion" av JOIN "QuestionVersion" qv ON qv.id=av."questionVersionId"
        JOIN "Question" q ON q.id=qv."questionId"
        WHERE av."subjectId"=$1 AND q.domain='RADAR' AND ($2::uuid IS NULL OR av.id>$2)
        ORDER BY av.id LIMIT 21`, [actorId, cursor],
    );
    return apiJson(page(result.rows));
  }
  if (method === "GET" && route === "/radar/opportunities") {
    const opaque = new URL(request.url).searchParams.get("cursor");
    const decoded = opaque ? z.tuple([uuid, uuid, uuid]).parse(
      JSON.parse(Buffer.from(opaque, "base64url").toString("utf8"))) : null;
    const result = await pool.query<{ targetId: string; grantId: string; questionVersionId: string; selfAnswerVersionId: string }>(
      `SELECT * FROM orvok_radar_opportunities($1)
        WHERE ($2::uuid IS NULL OR ("targetId","grantId","questionVersionId") > ($2,$3,$4))
        ORDER BY "targetId","grantId","questionVersionId" LIMIT 21`,
      [sessionHash, decoded?.[0] ?? null, decoded?.[1] ?? null, decoded?.[2] ?? null],
    );
    const items = result.rows.slice(0, 20);
    const last = items.at(-1);
    const nextCursor = result.rows.length > 20 && last
      ? Buffer.from(JSON.stringify([last.targetId, last.grantId, last.questionVersionId])).toString("base64url") : null;
    return apiJson({ items, nextCursor });
  }
  if (method === "GET" && route === "/radar/dashboard") {
    const [made, received, pending, matches] = await Promise.all([
      pool.query<{ id: string; targetId: string; questionVersionId: string; predictedAt: Date }>(
        `SELECT id,"targetId","questionVersionId","predictedAt" FROM "SocialPredictionSnapshot"
          WHERE "predictorId"=$1 ORDER BY "predictedAt" DESC,id DESC LIMIT 21`, [actorId]),
      pool.query<{ id: string; predictorId: string; questionVersionId: string; predictedAt: Date }>(
        `SELECT id,"predictorId","questionVersionId","predictedAt" FROM "SocialPredictionSnapshot"
          WHERE "targetId"=$1 ORDER BY "predictedAt" DESC,id DESC LIMIT 21`, [actorId]),
      pool.query<{ id: string; predictorId: string; invitedAt: Date; expiresAt: Date | null }>(
        `SELECT i.id,i."predictorId",i."invitedAt",i."expiresAt" FROM "RadarInvitation" i
          LEFT JOIN "RadarInvitationAcceptance" a ON a."invitationId"=i.id
          WHERE i."targetId"=$1 AND a.id IS NULL
            AND (i."expiresAt" IS NULL OR i."expiresAt">clock_timestamp())
          ORDER BY i."invitedAt" DESC,i.id DESC LIMIT 21`, [actorId]),
      pool.query<{ userId: string; mutualAt: Date }>(`SELECT * FROM orvok_radar_mutual_connections($1) LIMIT 21`, [sessionHash]),
    ]);
    return apiJson({
      made: made.rows.slice(0, 20), received: received.rows.slice(0, 20),
      pendingInvitations: pending.rows.slice(0, 20), matches: matches.rows.slice(0, 20),
      hasMore: { made: made.rows.length > 20, received: received.rows.length > 20,
        pendingInvitations: pending.rows.length > 20, matches: matches.rows.length > 20 },
    });
  }
  if (method === "POST" && route === "/radar/invitations") {
    const body = inviteBody.parse(await readJsonBody(request));
    const result = await withIdempotency(pool, actorId, route, request.headers.get("Idempotency-Key"), body, async () => ({
      status: 201,
      data: { invitationId: await rpc.invite(body.targetId) },
    }));
    return apiJson(result.data, result.status);
  }
  if (method === "GET" && route === "/radar/invitations") {
    const cursor = pageCursor(request);
    const result = await pool.query<{ id: string; predictorId: string; targetId: string; invitedAt: Date; expiresAt: Date | null; acceptanceId: string | null; acceptedAt: Date | null }>(
      `SELECT i.id,i."predictorId",i."targetId",i."invitedAt",i."expiresAt",a.id AS "acceptanceId",a."acceptedAt" FROM "RadarInvitation" i LEFT JOIN "RadarInvitationAcceptance" a ON a."invitationId"=i.id WHERE (i."predictorId"=$1 OR i."targetId"=$1) AND ($2::uuid IS NULL OR i.id>$2) ORDER BY i.id LIMIT 21`,
      [actorId, cursor],
    );
    return apiJson(page(result.rows));
  }
  if (method === "POST" && path.length === 4 && path[0] === "radar" && path[1] === "invitations" && path[3] === "accept") {
    const invitationId = uuid.parse(path[2]);
    z.strictObject({}).parse(await readJsonBody(request));
    const result = await withIdempotency(pool, actorId, route, request.headers.get("Idempotency-Key"), {}, async () => ({
      status: 201,
      data: { acceptanceId: await rpc.accept(invitationId) },
    }));
    return apiJson(result.data, result.status);
  }
  if (method === "POST" && route === "/radar/consents") {
    const body = grantBody.parse(await readJsonBody(request));
    requireAccess(canAccess({ role, actorId, resource: "CONSENT", action: "CREATE", ownerId: actorId }));
    await operations.assertApprovedNotice({ purpose: "BE_PREDICTED", noticeVersion: body.noticeVersion, noticeHash: body.noticeHash });
    const result = await withIdempotency(pool, actorId, route, request.headers.get("Idempotency-Key"), body, async () => {
      const grant = await rpc.grant(body.acceptanceId, body.presentationId, body.scope, body.noticeVersion, body.noticeHash);
      return { status: 201, data: { grantId: grant.id, consentVersion: grant.version } };
    }, async (data) => {
      const active = await pool.query(`SELECT 1 FROM "ConsentGrant" g WHERE g.id=$1 AND g."subjectId"=$2 AND NOT EXISTS (SELECT 1 FROM "ConsentRevocation" r WHERE r."grantId"=g.id)`, [data.grantId, actorId]);
      if (!active.rowCount) throw new OperationalApiError(409, "CONFLICT");
    });
    return apiJson(result.data, result.status);
  }
  if (method === "GET" && route === "/radar/consents") {
    requireAccess(canAccess({ role, actorId, resource: "CONSENT", action: "READ", ownerId: actorId }));
    const cursor = pageCursor(request);
    const result = await pool.query<{ id: string; purpose: string; scope: string; noticeVersion: string; consentVersion: number; grantedAt: Date; revokedAt: Date | null }>(
      `SELECT g.id,g.purpose,g.scope,g."noticeVersion",g."consentVersion",g."grantedAt",r."revokedAt" FROM "ConsentGrant" g LEFT JOIN "ConsentRevocation" r ON r."grantId"=g.id WHERE g."subjectId"=$1 AND ($2::uuid IS NULL OR g.id>$2) ORDER BY g.id LIMIT 21`,
      [actorId, cursor],
    );
    return apiJson(page(result.rows));
  }
  if (method === "POST" && route === "/radar/self-answer-consents") {
    const body = z.strictObject({ presentationId: uuid, accepted: z.literal(true), noticeVersion: z.string().min(1).max(80), noticeHash: z.string().regex(/^[a-f0-9]{64}$/) }).parse(await readJsonBody(request));
    requireAccess(canAccess({ role, actorId, resource: "CONSENT", action: "CREATE", ownerId: actorId }));
    const result = await withIdempotency(pool, actorId, route, request.headers.get("Idempotency-Key"), body, async () => {
      await operations.assertApprovedNotice({ purpose: "SELF_ANSWER", noticeVersion: body.noticeVersion, noticeHash: body.noticeHash });
      const grant = await rpc.grantSelf(body.presentationId, body.noticeVersion, body.noticeHash);
      return { status: 201, data: { grantId: grant.id, consentVersion: grant.version } };
    }, async (data) => {
      const active = await pool.query(`SELECT 1 FROM "ConsentGrant" g WHERE g.id=$1 AND g."subjectId"=$2 AND NOT EXISTS (SELECT 1 FROM "ConsentRevocation" r WHERE r."grantId"=g.id)`, [data.grantId, actorId]);
      if (!active.rowCount) throw new OperationalApiError(409, "CONFLICT");
    });
    return apiJson(result.data, result.status);
  }
  if (method === "POST" && path.length === 4 && path[0] === "radar" && path[1] === "consents" && path[3] === "revoke") {
    const grantId = uuid.parse(path[2]);
    z.strictObject({}).parse(await readJsonBody(request));
    requireAccess(canAccess({ role, actorId, resource: "CONSENT", action: "CREATE", ownerId: actorId }));
    const result = await withIdempotency(pool, actorId, route, request.headers.get("Idempotency-Key"), {}, async () => ({
      status: 201,
      data: { revocationId: await rpc.revoke(grantId) },
    }));
    return apiJson(result.data, result.status);
  }
  if (method === "POST" && path.length === 4 && path[0] === "radar" && path[1] === "self-answer-consents" && path[3] === "revoke") {
    const grantId = uuid.parse(path[2]);
    z.strictObject({}).parse(await readJsonBody(request));
    requireAccess(canAccess({ role, actorId, resource: "CONSENT", action: "CREATE", ownerId: actorId }));
    const result = await withIdempotency(pool, actorId, route, request.headers.get("Idempotency-Key"), {}, async () => ({
      status: 201,
      data: { revocationId: await rpc.revokeSelf(grantId) },
    }));
    return apiJson(result.data, result.status);
  }
  if (method === "POST" && route === "/radar/answers") {
    const body = answerBody.parse(await readJsonBody(request));
    requireAccess(canAccess({ role, actorId, resource: "RADAR_ANSWER", action: "CREATE", ownerId: actorId }));
    const result = await withIdempotency(pool, actorId, route, request.headers.get("Idempotency-Key"), body, async () => {
      const answer = await rpc.answer(body.questionVersionId, body.optionId, body.consentGrantId, body.supersedesId);
      return { status: 201, data: { answerVersionId: answer.id, version: answer.version } };
    }, async (data) => {
      const active = await pool.query(`SELECT 1 FROM "AnswerVersion" a WHERE a.id=$1 AND a."subjectId"=$2 AND NOT EXISTS (SELECT 1 FROM "ConsentRevocation" r WHERE r."grantId"=a."consentGrantId")`, [data.answerVersionId, actorId]);
      if (!active.rowCount) throw new OperationalApiError(409, "CONFLICT");
    });
    return apiJson(result.data, result.status);
  }
  if (method === "POST" && route === "/radar/predictions") {
    const body = predictionBody.parse(await readJsonBody(request));
    const result = await withIdempotency(pool, actorId, route, request.headers.get("Idempotency-Key"), body, async () => {
      const snapshot = await rpc.predict(body);
      return { status: 201, data: { snapshotId: snapshot.id, consentVersion: snapshot.consentVersion } };
    }, async (data) => {
      const visible = await pool.query(`SELECT 1 FROM "SocialPredictionSnapshot" WHERE id=$1 AND "predictorId"=$2`, [data.snapshotId, actorId]);
      if (!visible.rowCount) throw new OperationalApiError(409, "CONFLICT");
    });
    return apiJson(result.data, result.status);
  }
  if (method === "GET" && path.length === 3 && path[0] === "radar" && path[1] === "snapshots") {
    const id = uuid.parse(path[2]);
    const result = await pool.query<{ id: string; predictorId: string; targetId: string; questionVersionId: string; probabilityVector: unknown; predictedAt: Date; targetConsentGrantId: string; targetConsentVersion: number; snapshotHash: string; scope: "PRIVATE" | "SHARED" | "PUBLIC"; active: boolean }>(
      `SELECT * FROM orvok_read_snapshot($1)`,
      [id],
    );
    const row = result.rows[0];
    if (!row || !canAccess({ role, actorId, resource: "RADAR_SNAPSHOT", action: "READ", predictorId: row.predictorId, targetId: row.targetId, visibility: row.scope, consentActive: row.active }))
      throw new OperationalApiError(404, "NOT_FOUND");
    return apiJson({ snapshot: { id: row.id, predictorId: row.predictorId, targetId: row.targetId, questionVersionId: row.questionVersionId, probabilityVector: row.probabilityVector, predictedAt: row.predictedAt, consentVersion: row.targetConsentVersion, snapshotHash: row.snapshotHash } });
  }
  if (method === "GET" && route === "/me/export") {
    requireAccess(canAccess({ role, actorId, resource: "DATA_REQUEST", action: "READ", ownerId: actorId }));
    return rights.streamOwnData(actorId, request.signal);
  }
  if (method === "POST" && route === "/me/erasure-requests") {
    z.strictObject({}).parse(await readJsonBody(request));
    requireAccess(canAccess({ role, actorId, resource: "DATA_REQUEST", action: "CREATE", ownerId: actorId }));
    const result = await withIdempotency(pool, actorId, route, request.headers.get("Idempotency-Key"), {}, async () => ({
      status: 202,
      data: { requestId: await rights.requestDataAction(actorId, "ERASURE"), state: "RECEIVED" },
    }));
    return apiJson(result.data, result.status);
  }
  if (method === "POST" && route === "/me/export-requests") {
    z.strictObject({}).parse(await readJsonBody(request));
    requireAccess(canAccess({ role, actorId, resource: "DATA_REQUEST", action: "CREATE", ownerId: actorId }));
    const result = await withIdempotency(pool, actorId, route, request.headers.get("Idempotency-Key"), {}, async () => ({
      status: 202,
      data: { requestId: await rights.requestDataAction(actorId, "EXPORT"), state: "RECEIVED" },
    }));
    return apiJson(result.data, result.status);
  }
  if (method === "GET" && route === "/me/data-requests") {
    const cursor = pageCursor(request);
    const result = await pool.query<{ id: string; type: string; status: string; requestedAt: Date }>(
      `SELECT id,type,status,"requestedAt" FROM "DataRequest" WHERE "subjectId"=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT 21`,
      [actorId, cursor],
    );
    return apiJson(page(result.rows));
  }
  if (method === "GET" && route === "/notifications") {
    const cursor = pageCursor(request);
    const result = await pool.query<{ id: string; eventType: string; state: string; createdAt: Date }>(
      `SELECT id,"eventType",state,"createdAt" FROM "Notification" WHERE "recipientId"=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT 21`,
      [actorId, cursor],
    );
    return apiJson(page(result.rows));
  }
  if (method === "POST" && path.length === 3 && path[0] === "notifications" &&
      (path[2] === "read" || path[2] === "dismiss")) {
    const notificationId = uuid.parse(path[1]);
    z.strictObject({}).parse(await readJsonBody(request));
    const nextState = path[2] === "read" ? "READ" : "DISMISSED";
    const result = await withIdempotency(pool, actorId, route, request.headers.get("Idempotency-Key"), {}, async () => {
      const current = await pool.query<{ state: string }>(
        `SELECT state FROM "Notification" WHERE id=$1 AND "recipientId"=$2`, [notificationId, actorId]);
      if (!current.rows[0]) throw new OperationalApiError(404, "NOT_FOUND");
      if (current.rows[0].state === "DISMISSED" ||
          (nextState === "READ" && current.rows[0].state !== "UNREAD"))
        throw new OperationalApiError(409, "CONFLICT");
      const updated = await pool.query(
        nextState === "READ"
          ? `UPDATE "Notification" SET state='READ',"readAt"=clock_timestamp() WHERE id=$1 AND "recipientId"=$2 AND state='UNREAD' RETURNING id`
          : `UPDATE "Notification" SET state='DISMISSED',"dismissedAt"=clock_timestamp() WHERE id=$1 AND "recipientId"=$2 AND state IN ('UNREAD','READ') RETURNING id`,
        [notificationId, actorId],
      );
      if (!updated.rowCount) throw new OperationalApiError(409, "CONFLICT");
      return { status: 201, data: { id: notificationId, state: nextState } };
    });
    return apiJson(result.data, result.status);
  }
  if (method === "GET" && route === "/admin/audit") {
    requireAccess(canAccess({ role, actorId, resource: "AUDIT", action: "READ" }));
    const cursor = pageCursor(request);
    const result = await pool.query<{ id: string; actorId: string | null; action: string; objectType: string; objectId: string; occurredAt: Date }>(
      `SELECT id,"actorId",action,"objectType","objectId","occurredAt" FROM "AuditLog" WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 21`,
      [cursor],
    );
    return apiJson(page(result.rows));
  }
  throw new OperationalApiError(404, "NOT_FOUND");
}

type Context = { params: Promise<{ path?: string[] }> };

export async function GET(request: Request, context: Context) {
  try { return await handler(request, "GET", (await context.params).path ?? []); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request, context: Context) {
  try { return await handler(request, "POST", (await context.params).path ?? []); }
  catch (error) {
    try {
      const principal = await requirePrincipal(request);
      const path = (await context.params).path ?? [];
      const contextHash = createHash("sha256").update(`POST /api/v1/${path.join("/")}`).digest("hex");
      const session = readSessionCookie(request);
      if (!session) throw new Error("NO_SESSION");
      await operationalPool(tokenHash(session)).query(
        `INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","contextHash","occurredAt") VALUES ($1,$2,'API_MUTATION_BLOCKED','User',$2,$3,clock_timestamp())`,
        [randomUUID(), principal.userId, contextHash],
      );
    } catch {
      // No user audit row can be attributed without a valid, verified session.
    }
    return apiError(error);
  }
}

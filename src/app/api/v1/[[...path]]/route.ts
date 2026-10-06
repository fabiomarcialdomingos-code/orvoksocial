import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { canAccess } from "@/lib/access-control";
import { assertMutationRequest, authPool, readSessionCookie, requirePrincipal } from "@/lib/auth/session";
import { tokenHash } from "@/lib/auth/crypto";
import { AuthService } from "@/lib/auth/service";
import { DataRightsService } from "@/lib/api/data-rights";
import { exportarConvitesEMundo } from "@/lib/api/dados-convites";
import { lerTokenConvidado } from "@/lib/desafio/service";
import { withIdempotency } from "@/lib/api/idempotency";
import { operationalPool } from "@/lib/api/operational-db";
import { enforceOperationalRateLimit } from "@/lib/api/rate-limit";
import { apiError, apiJson, OperationalApiError } from "@/lib/api/response";
import { SocialOperations } from "@/lib/api/social-operations";
import { WorldOperations } from "@/lib/api/world-operations";
import { handleExperienceRoute, resolveInviteTarget } from "@/lib/api/experience-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.uuid();

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
  const rights = new DataRightsService(pool);
  const social = new SocialOperations(pool);
  const world = new WorldOperations(pool);
  void social;
  const route = `/${path.join("/")}`;
  if (method === "POST") await enforceOperationalRateLimit(pool, route);

  if (method === "GET" && route === "/users/me") {
    requireAccess(canAccess({ role, actorId, resource: "PROFILE", action: "READ", ownerId: actorId }));
    const result = await pool.query(`SELECT id,status,"createdAt" FROM "User" WHERE id=$1`, [actorId]);
    return apiJson({ user: result.rows[0] ?? null });
  }
  if (method === "GET" && route === "/me/export") {
    requireAccess(canAccess({ role, actorId, resource: "DATA_REQUEST", action: "READ", ownerId: actorId }));
    // Convites, retrato, Mundo e conversas vivem em tabelas próprias; entram no mesmo arquivo.
    const convitesEMundo = await exportarConvitesEMundo(authPool(), actorId, lerTokenConvidado(request));
    return rights.streamOwnData(actorId, request.signal, convitesEMundo);
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
  if (method === "GET" && route === "/admin/metrics") {
    requireAccess(canAccess({ role, actorId, resource: "AUDIT", action: "READ" }));
    const queries = [
      ["users", `SELECT count(*)::int AS count FROM "User"`],
      ["activeUsers", `SELECT count(*)::int AS count FROM "User" WHERE status='ACTIVE'`],
      ["events", `SELECT count(*)::int AS count FROM "WorldEvent"`],
      ["publishedEvents", `SELECT count(*)::int AS count FROM "WorldEvent" WHERE status='PUBLISHED'`],
      ["reports", `SELECT count(*)::int AS count FROM "SocialReport" WHERE state IN ('OPEN','REVIEWING')`],
    ] as const;
    const values = await Promise.all(queries.map(async ([key, sql]) => {
      try { const result = await pool.query<{ count: number }>(sql); return [key, Number(result.rows[0]?.count ?? 0)] as const; }
      catch { return [key, 0] as const; }
    }));
    // Convites, visões e conversas vivem em tabelas do módulo do Retrato/Mundo, lidas pelo outro papel do banco.
    const produto = [
      ["invites", `SELECT count(*)::int AS count FROM "GuestChallenge" WHERE "revokedAt" IS NULL`],
      ["views", `SELECT count(*)::int AS count FROM "GuestChallengeAttempt"`],
      ["worldRounds", `SELECT count(*)::int AS count FROM "WorldRound" WHERE "revokedAt" IS NULL`],
      ["privateThreads", `SELECT count(*)::int AS count FROM "RoundThread" WHERE status='ACCEPTED'`],
      ["shelfPeople", `SELECT count(*)::int AS count FROM "ShelfPerson"`],
      ["keepsakes", `SELECT count(*)::int AS count FROM "Keepsake" WHERE state<>'REMOVED'`],
      ["keepsakeReactions", `SELECT count(*)::int AS count FROM "Keepsake" WHERE reaction IS NOT NULL AND state<>'REMOVED'`],
      ["shelfBonds", `SELECT count(*)::int AS count FROM "ShelfBond" WHERE status='ACTIVE'`],
      ["shelfReportsOpen", `SELECT count(*)::int AS count FROM "ShelfReport" WHERE state='OPEN'`],
    ] as const;
    const valoresProduto = await Promise.all(produto.map(async ([key, sql]) => {
      try { const result = await authPool().query<{ count: number }>(sql); return [key, Number(result.rows[0]?.count ?? 0)] as const; }
      catch { return [key, 0] as const; }
    }));
    return apiJson({ metrics: Object.fromEntries([...values, ...valoresProduto]), generatedAt: new Date().toISOString() });
  }
  if (method === "GET" && route === "/admin/reports") {
    requireAccess(canAccess({ role, actorId, resource: "AUDIT", action: "READ" }));
    const result = await pool.query(`SELECT id,"reporterId","targetUserId","postId",reason,state,"createdAt","resolvedAt" FROM "SocialReport" ORDER BY "createdAt" DESC LIMIT 100`);
    return apiJson({ items: result.rows });
  }
  if (method === "GET" && route === "/world/events") {
    const params = new URL(request.url).searchParams;
    const cursor = params.get("cursor");
    const decoded = cursor ? uuid.parse(Buffer.from(cursor,"base64url").toString("utf8")) : null;
    const category = params.get("category");
    const status = params.get("status");
    if (category && !/^[A-Za-z0-9_-]{1,80}$/.test(category)) throw new OperationalApiError(400, "VALIDATION_ERROR");
    if (status && !/^[A-Z_]{1,16}$/.test(status)) throw new OperationalApiError(400, "VALIDATION_ERROR");
    return apiJson(await world.listEvents(actorId, decoded, { category, status }));
  }
  if (method === "POST" && route === "/world/events") {
    requireAccess(canAccess({ role, actorId, resource: "AUDIT", action: "READ" }));
    const body = z.strictObject({ category:z.enum(["economia","tecnologia","esporte","entretenimento"]), title:z.string().trim().min(1).max(240), description:z.string().max(4000).optional(), sourceUrl:z.string().url().max(2000).optional(), resolutionCriteria:z.string().trim().min(1).max(4000), opensAt:z.string().datetime(), closesAt:z.string().datetime(), startsAt:z.string().datetime().optional(), opportunities:z.array(z.strictObject({code:z.string().trim().min(1).max(64),label:z.string().trim().min(1).max(300)})).min(2).max(32), reason:z.string().trim().min(1).max(1000) }).parse(await readJsonBody(request));
    return apiJson(await world.createEvent(actorId,body,body.reason),201);
  }
  if (method === "POST" && path.length===4 && path[0]==="admin" && path[1]==="events" && path[3]==="publish") {
    requireAccess(canAccess({ role, actorId, resource: "AUDIT", action: "READ" }));
    const body=z.strictObject({reason:z.string().trim().min(1).max(1000)}).parse(await readJsonBody(request));
    return apiJson(await world.publishEvent(actorId,path[2]!,body.reason));
  }
  if (method === "POST" && path.length===4 && path[0]==="world" && path[1]==="events" && path[3]==="resolve") {
    requireAccess(canAccess({ role, actorId, resource: "AUDIT", action: "READ" }));
    const body=z.strictObject({state:z.enum(["TEST","OFFICIAL","CANCELLED","VOID"]),outcomeOpportunityId:uuid.optional(),rationale:z.string().trim().min(1).max(4000)}).parse(await readJsonBody(request));
    return apiJson(await world.resolve(actorId,path[2]!,body));
  }
  if (method === "GET" && route === "/admin/users") {
    requireAccess(canAccess({ role, actorId, resource: "AUDIT", action: "READ" })); const cursor=pageCursor(request); return apiJson(await world.adminUsers(actorId,cursor));
  }
  if (method === "GET" && route === "/social/profile") {
    const result = await pool.query(`SELECT "userId","displayName","avatarUrl",bio,"updatedAt" FROM "UserProfile" WHERE "userId"=$1`, [actorId]);
    return apiJson({ profile: result.rows[0] ?? null });
  }
  if (method === "POST" && route === "/social/profile") {
    const body = z.strictObject({ displayName: z.string().trim().min(1).max(120), avatarUrl: z.string().url().max(1000).optional(), bio: z.string().max(500).optional() }).parse(await readJsonBody(request));
    return apiJson({ profile: await social.profile(actorId, body) });
  }
  if (method === "POST" && route === "/social/groups") {
    const body = z.strictObject({ name: z.string().trim().min(1).max(160), description: z.string().max(1000).optional() }).parse(await readJsonBody(request));
    return apiJson(await social.createGroup(actorId, body), 201);
  }
  if (method === "GET" && route === "/social/groups") {
    const result = await pool.query(`SELECT g.id,g."ownerId",g.name,g.description,g.state,g."createdAt" FROM "SocialGroup" g JOIN "SocialGroupMember" m ON m."groupId"=g.id WHERE m."userId"=$1 AND m.state='ACTIVE' ORDER BY g."createdAt" DESC`, [actorId]);
    return apiJson({ items: result.rows });
  }
  if (method === "POST" && path.length === 4 && path[0] === "social" && path[1] === "groups" && path[3] === "invites") {
    const body = z.union([z.strictObject({ inviteeId: uuid }), z.strictObject({ email: z.email().max(320) })]).parse(await readJsonBody(request));
    const inviteeId = "inviteeId" in body ? body.inviteeId : await resolveInviteTarget(pool, sessionHash, body);
    return apiJson(await social.inviteGroup(actorId, uuid.parse(path[2]), inviteeId), 201);
  }
  if (method === "POST" && path.length === 4 && path[0] === "social" && path[1] === "group-invites" && path[3] === "accept") return apiJson(await social.acceptGroup(actorId, path[2]!));
  if (method === "POST" && path.length === 4 && path[0] === "social" && path[1] === "groups" && path[3] === "events") {
    const body = z.strictObject({ title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional() }).parse(await readJsonBody(request));
    return apiJson(await social.createEvent(actorId, { ...body, groupId: path[2]! }), 201);
  }
  if (method === "POST" && path.length === 4 && path[0] === "social" && path[1] === "events" && path[3] === "state") {
    const body = z.strictObject({ state: z.enum(["FROZEN", "RESOLVED_TEST", "CANCELLED"]) }).parse(await readJsonBody(request));
    return apiJson(await social.setEventState(actorId, path[2]!, body.state));
  }
  if (method === "POST" && route === "/social/blocks") { const body = z.strictObject({ userId: uuid }).parse(await readJsonBody(request)); return apiJson(await social.block(actorId, body.userId), 201); }
  if (method === "POST" && route === "/social/reports") { const body = z.strictObject({ targetUserId: uuid, reason: z.string().trim().min(1).max(500) }).parse(await readJsonBody(request)); return apiJson(await social.report(actorId, body), 201); }
  if (method === "POST" && path.length === 4 && path[0] === "admin" && path[1] === "users" && path[3] === "action") {
    requireAccess(canAccess({ role, actorId, resource: "AUDIT", action: "READ" }));
    const body = z.strictObject({ action: z.enum(["SUSPEND", "UNSUSPEND", "TEMPORARY_BLOCK", "PASSWORD_RESET" ]), reason: z.string().trim().min(1).max(1000) }).parse(await readJsonBody(request));
    const targetId = uuid.parse(path[2]);
    // Every branch must actually change something (or throw) before the success
    // row below is written — an admin action that records success without an
    // effect is worse than one that fails loudly, especially mid-incident.
    if (body.action === "SUSPEND" || body.action === "TEMPORARY_BLOCK") {
      const updated = await pool.query(`UPDATE "User" SET status='SUSPENDED' WHERE id=$1 AND status='ACTIVE' RETURNING id`, [targetId]);
      if (!updated.rowCount) throw new OperationalApiError(404, "NOT_FOUND");
      await new AuthService(authPool()).adminRevokeSessions(targetId);
    } else if (body.action === "UNSUSPEND") {
      const updated = await pool.query(`UPDATE "User" SET status='ACTIVE' WHERE id=$1 AND status='SUSPENDED' RETURNING id`, [targetId]);
      if (!updated.rowCount) throw new OperationalApiError(404, "NOT_FOUND");
    } else {
      await new AuthService(authPool()).adminForcePasswordReset(targetId);
    }
    const actionId = randomUUID();
    await pool.query(`INSERT INTO "AdminAction" (id,"adminId","targetUserId",action,reason) VALUES ($1,$2,$3,$4,$5)`, [actionId, actorId, targetId, body.action, body.reason]);
    await pool.query(`INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt") VALUES ($1,$2,$3,'User',$4,clock_timestamp())`, [randomUUID(), actorId, `ADMIN_${body.action}`, targetId]);
    return apiJson({ actionId });
  }
  const experience = await handleExperienceRoute({ method, route, request, pool, actorId });
  if (experience) return experience;
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

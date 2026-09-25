import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Pool } from "pg";
import { apiJson, OperationalApiError } from "./response";

/**
 * Read models for the redesigned experience. Every query runs through the
 * session-bound operational pool, so RLS decides which rows exist; these
 * handlers only shape data the actor could already read piecemeal.
 */
export interface ExperienceContext {
  sessionHash: string;
  readBody: () => Promise<unknown>;
  method: "GET" | "POST";
  path: string[];
  route: string;
  request: Request;
  pool: Pool;
  actorId: string;
}

const uuid = z.uuid();

export async function handleExperienceRoute(ctx: ExperienceContext): Promise<Response | null> {
  const { method, path, route, request, pool, actorId, sessionHash, readBody } = ctx;

  // Display names for people the actor interacts with. Profiles are public
  // inside the product (policy social_profile_select), ids are capped at 50.
  if (method === "GET" && route === "/people") {
    const raw = new URL(request.url).searchParams.get("ids") ?? "";
    const ids = z.array(uuid).max(50).parse(raw.split(",").map((value) => value.trim()).filter(Boolean));
    if (!ids.length) return apiJson({ items: [] });
    const result = await pool.query(
      `SELECT "userId","displayName","avatarUrl",bio FROM "UserProfile" WHERE "userId" = ANY($1::uuid[])`,
      [ids],
    );
    return apiJson({ items: result.rows });
  }

  // The encounter: everything the target needs to compare their own answers
  // with the latest prediction of each person, per question. Snapshot rows are
  // filtered by orvok_snapshot_visible(), so revoked consent removes them.
  if (method === "GET" && route === "/radar/encounter") {
    const [answers, received, questions] = await Promise.all([
      pool.query<{ questionVersionId: string; optionId: string; answeredAt: Date }>(
        `SELECT DISTINCT ON (av."questionVersionId") av."questionVersionId",av."optionId",av."answeredAt"
           FROM "AnswerVersion" av WHERE av."subjectId"=$1
           ORDER BY av."questionVersionId",av.version DESC`,
        [actorId],
      ),
      pool.query<{ id: string; predictorId: string; questionVersionId: string; probabilityVector: number[]; predictedAt: Date }>(
        `SELECT DISTINCT ON (s."predictorId",s."questionVersionId") s.id,s."predictorId",s."questionVersionId",
                s."probabilityVector",s."predictedAt"
           FROM "SocialPredictionSnapshot" s WHERE s."targetId"=$1
           ORDER BY s."predictorId",s."questionVersionId",s."predictedAt" DESC
           LIMIT 500`,
        [actorId],
      ),
      pool.query<{ questionVersionId: string; text: string; options: { id: string; label: string; position: number }[] }>(
        `SELECT qv.id AS "questionVersionId",qv.text,
                COALESCE(jsonb_agg(jsonb_build_object('id',ao.id,'label',ao.label,'position',ao.position)
                  ORDER BY ao.position) FILTER (WHERE ao.id IS NOT NULL),'[]'::jsonb) AS options
           FROM "QuestionVersion" qv JOIN "Question" q ON q.id=qv."questionId"
           LEFT JOIN "AnswerOption" ao ON ao."questionVersionId"=qv.id
           WHERE q.domain='RADAR' AND orvok_catalog_version_enabled(qv.id)
           GROUP BY qv.id,qv.text ORDER BY qv.id`,
      ),
    ]);
    return apiJson({ answers: answers.rows, received: received.rows, questions: questions.rows });
  }

  // Latest prediction the actor made per (target, question), for progress and
  // for superseding a previous prediction instead of duplicating it.
  if (method === "GET" && route === "/radar/made") {
    const result = await pool.query(
      `SELECT DISTINCT ON (s."targetId",s."questionVersionId") s.id,s."targetId",s."questionVersionId",
              s."probabilityVector",s."predictedAt"
         FROM "SocialPredictionSnapshot" s WHERE s."predictorId"=$1
         ORDER BY s."targetId",s."questionVersionId",s."predictedAt" DESC LIMIT 1000`,
      [actorId],
    );
    return apiJson({ items: result.rows });
  }

  // The actor's own World predictions, latest per event.
  if (method === "GET" && route === "/world/predictions") {
    const result = await pool.query(
      `SELECT DISTINCT ON (p."eventId") p.id,p."eventId",p."opportunityId",p.confidence,p."predictedAt"
         FROM "WorldPrediction" p WHERE p."predictorId"=$1
         ORDER BY p."eventId",p."predictedAt" DESC`,
      [actorId],
    );
    return apiJson({ items: result.rows });
  }

  // Comments of a World event, newest last.
  if (method === "GET" && path.length === 4 && path[0] === "world" && path[1] === "events" && path[3] === "comments") {
    const eventId = uuid.parse(path[2]);
    const result = await pool.query(
      `SELECT id,"authorId",body,"createdAt" FROM "WorldComment" WHERE "eventId"=$1 ORDER BY "createdAt" ASC LIMIT 100`,
      [eventId],
    );
    return apiJson({ items: result.rows });
  }

  // Comments of a feed post.
  if (method === "GET" && path.length === 4 && path[0] === "social" && path[1] === "posts" && path[3] === "comments") {
    const postId = uuid.parse(path[2]);
    const result = await pool.query(
      `SELECT id,"authorId",body,"createdAt" FROM "SocialComment" WHERE "postId"=$1 ORDER BY "createdAt" ASC LIMIT 100`,
      [postId],
    );
    return apiJson({ items: result.rows });
  }

  // Group invitations addressed to the actor that are still open.
  if (method === "GET" && route === "/social/group-invites") {
    const result = await pool.query(
      `SELECT id,"groupId","inviterId","createdAt" FROM "SocialGroupInvitation"
         WHERE "inviteeId"=$1 AND state='PENDING' ORDER BY "createdAt" DESC LIMIT 50`,
      [actorId],
    );
    return apiJson({ items: result.rows });
  }

  // Share links: invitations for people outside ORVOK.
  if (method === "GET" && route === "/radar/share-links") {
    const result = await pool.query(
      `SELECT l.id,l.code,l.theme,l."teaserQuestionVersionId",l.message,l.uses,l."maxUses",l."createdAt",l."expiresAt",l."revokedAt",
              (SELECT count(*)::int FROM "RadarShareRedemption" r WHERE r."linkId"=l.id) AS redemptions
         FROM "RadarShareLink" l WHERE l."ownerId"=$1 ORDER BY l."createdAt" DESC LIMIT 20`,
      [actorId],
    );
    return apiJson({ items: result.rows });
  }
  if (method === "POST" && route === "/radar/share-links") {
    const body = z.strictObject({
      theme: z.enum(["noite", "aurora", "mineral"]).default("noite"),
      teaserQuestionVersionId: uuid.nullable().optional(),
      message: z.string().trim().max(140).optional(),
    }).parse(await readBody());
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = randomBytes(10);
    const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    const result = await pool.query(
      `INSERT INTO "RadarShareLink" (code,"ownerId",theme,"teaserQuestionVersionId",message)
       VALUES ($1,$2,$3,$4,$5) RETURNING id,code,theme,"teaserQuestionVersionId",message,uses,"maxUses","createdAt","expiresAt"`,
      [code, actorId, body.theme, body.teaserQuestionVersionId ?? null, body.message || null],
    );
    return apiJson({ link: result.rows[0] }, 201);
  }
  if (method === "POST" && path.length === 4 && path[0] === "radar" && path[1] === "share-links" && path[3] === "revoke") {
    z.strictObject({}).parse(await readBody());
    const id = uuid.parse(path[2]);
    const result = await pool.query(
      `UPDATE "RadarShareLink" SET "revokedAt"=clock_timestamp() WHERE id=$1 AND "ownerId"=$2 AND "revokedAt" IS NULL RETURNING id`,
      [id, actorId],
    );
    if (!result.rowCount) throw new OperationalApiError(404, "NOT_FOUND");
    return apiJson({ id });
  }
  if (method === "POST" && route === "/radar/share-links/redeem") {
    const body = z.strictObject({ code: z.string().regex(/^[A-Za-z0-9]{8,16}$/) }).parse(await readBody());
    const result = await pool.query<{ invitation_id: string; owner_id: string; created: boolean }>(
      `SELECT * FROM orvok_share_link_redeem($1,$2)`, [sessionHash, body.code],
    );
    const row = result.rows[0]!;
    return apiJson({ invitationId: row.invitation_id, ownerId: row.owner_id, created: row.created }, row.created ? 201 : 200);
  }

  return null;
}

/** Resolve the invitation body: a known user id or a verified e-mail address. */
export const inviteTargetBody = z.union([
  z.strictObject({ targetId: uuid }),
  z.strictObject({ email: z.email().max(320) }),
]);

export async function resolveInviteTarget(
  pool: Pool,
  sessionHash: string,
  body: z.infer<typeof inviteTargetBody>,
): Promise<string> {
  if ("targetId" in body) return body.targetId;
  const result = await pool.query<{ target: string | null }>(
    `SELECT orvok_radar_resolve_target($1,$2) AS target`,
    [sessionHash, body.email],
  );
  const target = result.rows[0]?.target;
  if (!target) throw new OperationalApiError(404, "NOT_FOUND");
  return target;
}

import { z } from "zod";
import type { Pool } from "pg";
import { apiJson, OperationalApiError } from "./response";

/**
 * Read models for the redesigned experience. Every query runs through the
 * session-bound operational pool, so RLS decides which rows exist; these
 * handlers only shape data the actor could already read piecemeal.
 */
export interface ExperienceContext {
  method: "GET" | "POST";
  path: string[];
  route: string;
  request: Request;
  pool: Pool;
  actorId: string;
}

const uuid = z.uuid();

export async function handleExperienceRoute(ctx: ExperienceContext): Promise<Response | null> {
  const { method, path, route, request, pool, actorId } = ctx;

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

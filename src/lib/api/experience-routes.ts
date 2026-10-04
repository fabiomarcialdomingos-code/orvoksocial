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
  route: string;
  request: Request;
  pool: Pool;
  actorId: string;
}

const uuid = z.uuid();

export async function handleExperienceRoute(ctx: ExperienceContext): Promise<Response | null> {
  const { method, route, request, pool, actorId } = ctx;

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

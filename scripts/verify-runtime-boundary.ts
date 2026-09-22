import "dotenv/config";
import { config as loadDotenv } from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";

loadDotenv({ path: ".env.local", quiet: true });
const ownerUrl = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
const appUrl = process.env.APP_DATABASE_URL;
const authUrl = process.env.AUTH_DATABASE_URL;
if (!ownerUrl || !appUrl || !authUrl) throw new Error("RUNTIME_DATABASE_URLS_REQUIRED");

const owner = new Client({ connectionString: ownerUrl });
const app = new Client({ connectionString: appUrl });
const auth = new Client({ connectionString: authUrl });
const ids = { predictor: randomUUID(), target: randomUUID(), extraTarget: randomUUID(), session: randomUUID(), targetSession: randomUUID(), invitation: "", extraInvitation: "", acceptance: "" };
const hash = randomBytes(32).toString("hex");
const targetHash = randomBytes(32).toString("hex");

async function rejectsWith(client: Client, sql: string, params: unknown[], code: string) {
  try {
    await client.query(sql, params);
    throw new Error(`unexpected SQL success: ${sql.split(" ")[0]}`);
  } catch (error) {
    if ((error as { code?: string }).code !== code) throw error;
  }
}

await Promise.all([owner.connect(), app.connect(), auth.connect()]);
try {
  await owner.query(`INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp()),($2,clock_timestamp()),($3,clock_timestamp())`,
    [ids.predictor, ids.target, ids.extraTarget]);
  await owner.query(`INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt")
    VALUES ($1,$3,'fixture-only',clock_timestamp()),($2,$4,'fixture-only',clock_timestamp())`,
    [ids.predictor, ids.target, `${ids.predictor}@orvok.test`, `${ids.target}@orvok.test`]);
  await owner.query(`INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt")
    VALUES ($1,$2,$3,$4,clock_timestamp()+interval '1 hour'),
           ($5,$6,$7,$8,clock_timestamp()+interval '1 hour')`,
    [ids.session, ids.predictor, hash, randomUUID(), ids.targetSession, ids.target, targetHash, randomUUID()]);

  await rejectsWith(app, `INSERT INTO "RadarInvitation" (id,"predictorId","targetId","invitedAt")
    VALUES ($1,$2,$3,clock_timestamp())`, [randomUUID(), ids.predictor, ids.target], "42501");
  await rejectsWith(app, `INSERT INTO "RadarInvitationAcceptance" (id,"invitationId","targetId","acceptedAt")
    VALUES ($1,$2,$3,clock_timestamp())`, [randomUUID(), randomUUID(), ids.target], "42501");
  await rejectsWith(app, `INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","grantedAt")
    VALUES ($1,$2,'BE_PREDICTED','PRIVATE','forged',$3,clock_timestamp())`,
    [randomUUID(), ids.target, "a".repeat(64)], "42501");
  await rejectsWith(app, `INSERT INTO "SocialPredictionSnapshot" (id) VALUES ($1)`, [randomUUID()], "42501");
  await rejectsWith(app, `INSERT INTO "ConsentRevocation" (id,"grantId","subjectId","revokedAt")
    VALUES ($1,$2,$3,clock_timestamp())`, [randomUUID(), randomUUID(), ids.target], "42501");
  await rejectsWith(app, `DELETE FROM "SocialPredictionSnapshot" WHERE id=$1`, [randomUUID()], "42501");
  await rejectsWith(app, `UPDATE "SocialPredictionSnapshot" SET "predictedAt"=clock_timestamp() WHERE id=$1`, [randomUUID()], "42501");
  await rejectsWith(app, `SELECT "tokenHash" FROM "AuthSession" LIMIT 1`, [], "42501");
  await rejectsWith(app, `UPDATE "AuthSession" SET "revokedAt"=clock_timestamp() WHERE id=$1`, [ids.session], "42501");
  await rejectsWith(auth, `SELECT orvok_radar_invite($1,$2)`, [hash, ids.target], "42501");
  await rejectsWith(app, `SELECT orvok_radar_actor($1)`, [hash], "42501");
  await rejectsWith(auth, `UPDATE "User" SET role='ADMIN' WHERE id=$1`, [ids.predictor], "42501");
  await rejectsWith(auth, `INSERT INTO "User" (id,role,"updatedAt") VALUES ($1,'ADMIN',clock_timestamp())`,
    [randomUUID()], "42501");
  await rejectsWith(app, `SELECT orvok_radar_invite($1,$2)`, ["0".repeat(64), ids.target], "28000");

  const invitation = await app.query<{ id: string }>(`SELECT orvok_radar_invite($1,$2) AS id`, [hash, ids.target]);
  ids.invitation = invitation.rows[0]!.id;
  const stored = await owner.query(`SELECT "predictorId","targetId" FROM "RadarInvitation" WHERE id=$1`, [ids.invitation]);
  if (stored.rows[0]?.predictorId !== ids.predictor || stored.rows[0]?.targetId !== ids.target)
    throw new Error("RPC actor binding failed");
  const acceptance = await app.query<{ id: string }>(`SELECT orvok_radar_accept($1,$2) AS id`, [targetHash, ids.invitation]);
  ids.acceptance = acceptance.rows[0]!.id;
  await rejectsWith(app, `SELECT orvok_radar_accept($1,$2)`, [hash, ids.invitation], "23514");

  await app.query(`CREATE TEMP TABLE "AuthSession" ("tokenHash" text,"userId" uuid)`);
  await app.query(`INSERT INTO pg_temp."AuthSession" VALUES ($1,$2)`, ["0".repeat(64), ids.predictor]);
  await rejectsWith(app, `SELECT orvok_radar_invite($1,$2)`, ["0".repeat(64), ids.target], "28000");
  await app.query("BEGIN");
  ids.extraInvitation = (await app.query<{ id: string }>(`SELECT orvok_radar_invite($1,$2) AS id`,
    [hash, ids.extraTarget])).rows[0]!.id;
  await owner.query(`SET statement_timeout TO '200ms'`);
  try {
    await rejectsWith(owner, `UPDATE "AuthSession" SET "revokedAt"=clock_timestamp() WHERE id=$1`,
      [ids.session], "57014");
  } finally {
    await owner.query(`SET statement_timeout TO 0`);
    await app.query("COMMIT");
  }
  await owner.query(`UPDATE "AuthSession" SET "revokedAt"=clock_timestamp() WHERE id=$1`, [ids.session]);
  await rejectsWith(app, `SELECT orvok_radar_invite($1,$2)`, [hash, ids.target], "28000");
  console.log("runtime boundary: passed (DML denied, roles separated, valid/revoked session, session lock race, search_path)");
} finally {
  await owner.query(`DELETE FROM "Notification" WHERE "recipientId" IN ($1,$2,$3)`, [ids.predictor, ids.target, ids.extraTarget]);
  if (ids.invitation) {
    if (ids.extraInvitation) {
      await owner.query(`DELETE FROM "AuditLog" WHERE "objectId"=$1`, [ids.extraInvitation]);
      await owner.query(`DELETE FROM "RadarInvitation" WHERE id=$1`, [ids.extraInvitation]);
    }
    await owner.query(`DELETE FROM "AuditLog" WHERE "objectId"=$1`, [ids.acceptance]);
    await owner.query(`DELETE FROM "AuditLog" WHERE "objectId"=$1`, [ids.invitation]);
    if (ids.acceptance) await owner.query(`DELETE FROM "RadarInvitationAcceptance" WHERE id=$1`, [ids.acceptance]);
    await owner.query(`DELETE FROM "RadarInvitation" WHERE id=$1`, [ids.invitation]);
  }
  await owner.query(`DELETE FROM "AuthSession" WHERE id IN ($1,$2)`, [ids.session, ids.targetSession]);
  await owner.query(`DELETE FROM "AuthIdentity" WHERE "userId" IN ($1,$2)`, [ids.predictor, ids.target]);
  await owner.query(`DELETE FROM "User" WHERE id IN ($1,$2,$3)`, [ids.predictor, ids.target, ids.extraTarget]);
  await Promise.all([owner.end(), app.end(), auth.end()]);
}

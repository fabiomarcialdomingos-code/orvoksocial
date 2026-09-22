import "dotenv/config";
import { config as loadDotenv } from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { closeOperationalPool, operationalPool } from "../src/lib/api/operational-db";

loadDotenv({ path: ".env.local", quiet: true });
const ownerUrl = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
const appUrl = process.env.APP_DATABASE_URL;
if (!ownerUrl || !appUrl) throw new Error("DATABASE_URLS_REQUIRED");
const owner = new Client({ connectionString: ownerUrl });
const app = new Client({ connectionString: appUrl });
const a = randomUUID();
const b = randomUUID();
const aSession = randomUUID();
const bSession = randomUUID();
const auditId = randomUUID();
const aHash = randomBytes(32).toString("hex");
const bHash = randomBytes(32).toString("hex");

async function expectRows(sql: string, params: unknown[], count: number): Promise<void> {
  const rows = await app.query(sql, params);
  if (rows.rowCount !== count) throw new Error(`READ_SCOPE_FAILURE: ${sql.split(" ")[1]}`);
}
async function expectDenied(sql: string, params: unknown[], code: string): Promise<void> {
  try { await app.query(sql, params); throw new Error("UNEXPECTED_SQL_SUCCESS"); }
  catch (error) { if ((error as { code?: string }).code !== code) throw error; }
}

await Promise.all([owner.connect(), app.connect()]);
try {
  await owner.query(`INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp()),($2,clock_timestamp())`, [a,b]);
  await owner.query(`INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt")
    VALUES ($1,$3,'fixture-only',clock_timestamp()),($2,$4,'fixture-only',clock_timestamp())`,
    [a,b,`${a}@orvok.test`,`${b}@orvok.test`]);
  await owner.query(`INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt")
    VALUES ($1,$2,$3,$4,clock_timestamp()+interval '1 hour'),($5,$6,$7,$8,clock_timestamp()+interval '1 hour')`,
    [aSession,a,aHash,randomUUID(),bSession,b,bHash,randomUUID()]);
  await owner.query(`INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES ($1,$2,'FIXTURE','User',$2,clock_timestamp())`, [auditId,b]);

  for (const table of ["User","AnswerVersion","SocialPredictionSnapshot","AuditLog",
    "ConsentGrant","ConsentNoticePresentation","Notification","DataRequest","ApiIdempotency"]) {
    await expectRows(`SELECT * FROM "${table}" LIMIT 1`, [], 0);
  }
  await expectRows(`SELECT "userId",email FROM "AuthIdentity" LIMIT 1`, [], 0);
  await app.query("BEGIN");
  await app.query(`SELECT set_config('orvok.session_hash',$1,true)`, ["0".repeat(64)]);
  await expectRows(`SELECT * FROM "User" WHERE id=$1`, [a], 0);
  await app.query("COMMIT");

  await app.query("BEGIN");
  await app.query(`SELECT orvok_bind_read_actor($1)`, [aHash]);
  await expectRows(`SELECT * FROM "User" WHERE id=$1`, [a], 1);
  await expectRows(`SELECT * FROM "User" WHERE id=$1`, [b], 0);
  await expectRows(`SELECT "userId",email FROM "AuthIdentity" WHERE "userId"=$1`, [b], 0);
  await expectRows(`SELECT * FROM "AuditLog" WHERE id=$1`, [auditId], 0);
  await app.query("SAVEPOINT rate_probe");
  await expectDenied(`UPDATE "AuthRateLimit" SET attempts=0 WHERE "keyHash"=$1`, ["0".repeat(64)], "42501");
  await app.query("ROLLBACK TO SAVEPOINT rate_probe");
  const charged = await app.query<{ attempts: number }>(`SELECT orvok_app_rate_attempt($1) AS attempts`, ["/read-boundary-fixture"]);
  if (charged.rows[0]?.attempts !== 1) throw new Error("RATE_RPC_NOT_BOUND");
  await expectDenied(`INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES ($1,$2,'RADAR_CONSENT_GRANTED','User',$2,clock_timestamp())`, [randomUUID(),a], "42501");
  await app.query("ROLLBACK");
  await expectRows(`SELECT * FROM "User" WHERE id=$1`, [a], 0);

  const own = operationalPool(aHash);
  const other = operationalPool(bHash);
  if ((await own.query(`SELECT id FROM "User" WHERE id=$1`, [a])).rowCount !== 1) throw new Error("SCOPED_POOL_OWN_READ");
  if ((await other.query(`SELECT id FROM "User" WHERE id=$1`, [a])).rowCount !== 0) throw new Error("SCOPED_POOL_CROSS_READ");
  if ((await own.query(`SELECT id FROM "User" WHERE id=$1`, [b])).rowCount !== 0) throw new Error("SCOPED_POOL_OTHER_READ");
  const held = await own.connect();
  await held.query("BEGIN");
  if ((await held.query(`SELECT id FROM "User" WHERE id=$1`, [a])).rowCount !== 1) throw new Error("SCOPED_TRANSACTION_READ");
  held.release(); // Async rollback before returning physical client to pool.
  if ((await other.query(`SELECT id FROM "User" WHERE id=$1`, [b])).rowCount !== 1) throw new Error("SCOPED_POOL_RELEASE_RESET");

  await owner.query(`UPDATE "AuthSession" SET "revokedAt"=clock_timestamp() WHERE id=$1`, [aSession]);
  try { await own.query(`SELECT id FROM "User" WHERE id=$1`, [a]); throw new Error("REVOKED_SESSION_READ"); }
  catch (error) { if ((error as { code?: string }).code !== "28000") throw error; }
  console.log("read boundary: passed (no hash, forged hash, own/cross actor, pooled release, revoked session, audit/rate forgery)");
} finally {
  await owner.query(`DELETE FROM "AuditLog" WHERE id=$1`, [auditId]);
  await owner.query(`DELETE FROM "AuthSession" WHERE id IN ($1,$2)`, [aSession,bSession]);
  await owner.query(`DELETE FROM "AuthIdentity" WHERE "userId" IN ($1,$2)`, [a,b]);
  await owner.query(`DELETE FROM "User" WHERE id IN ($1,$2)`, [a,b]);
  await Promise.all([owner.end(),app.end(),closeOperationalPool()]);
}

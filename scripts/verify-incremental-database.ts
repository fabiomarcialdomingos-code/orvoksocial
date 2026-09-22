import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";

if (process.env.APP_ENV !== "test" && process.env.APP_ENV !== "development")
  throw new Error("INCREMENTAL_DATABASE_VERIFIER_LOCAL_OR_CI_ONLY");
const ownerUrl = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!ownerUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = `orvok_incremental_${randomUUID().replaceAll("-", "")}`;
const target = new URL(ownerUrl);
target.pathname = `/${databaseName}`;
target.searchParams.set("schema", "public");
const admin = new Client({ connectionString: ownerUrl });
let created = false;
await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const db = new Client({ connectionString: target.toString() });
  await db.connect();
  try {
    const migrations = (await readdir("prisma/migrations", { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    const subjectId = randomUUID();
    const fixtureAdminId = randomUUID();
    let legacyGrants: string[] = [];
    const legacyNotice = { id: randomUUID(), presentationId: randomUUID(), grantId: randomUUID(), sessionId: randomUUID(), hash: "" };
    const legacyTokenHash = "f".repeat(64);
    for (const name of migrations) {
      if (name === "20260922020000_radar_consent_temporal") {
        legacyGrants = [randomUUID(), randomUUID()];
        await db.query(`INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp())`, [subjectId]);
        await db.query(`INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","grantedAt") VALUES
          ($1,$3,'BE_PREDICTED','PRIVATE','LEGACY',$4,clock_timestamp()),
          ($2,$3,'BE_PREDICTED','PRIVATE','LEGACY',$4,clock_timestamp())`,
          [legacyGrants[0], legacyGrants[1], subjectId, "a".repeat(64)]);
      }
      if (name === "20260922210000_notice_fixture_provenance") {
        const content = "FIXTURE legacy notice used only in an isolated migration regression database";
        legacyNotice.hash = createHash("sha256").update(content).digest("hex");
        await db.query(`INSERT INTO "User" (id,role,"updatedAt") VALUES ($1,'ADMIN',clock_timestamp())`, [fixtureAdminId]);
        await db.query(`INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt")
          VALUES ($1,$2,'TEST_ONLY',clock_timestamp())`, [subjectId,`${subjectId}@example.test`]);
        await db.query(`INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt")
          VALUES ($1,$2,$3,$4,clock_timestamp()+interval '1 hour')`,
          [legacyNotice.sessionId,subjectId,legacyTokenHash,randomUUID()]);
        await db.query(`INSERT INTO "ConsentNotice" (id,purpose,version,content,"contentHash",status,"approvedAt","approvedById","testOnly")
          VALUES ($1,'SELF_ANSWER','FIXTURE_LEGACY_REGRESSION',$2,$3,'APPROVED',clock_timestamp(),$4,false)`,
          [legacyNotice.id,content,legacyNotice.hash,fixtureAdminId]);
        await db.query(`INSERT INTO "ConsentNoticePresentation" (id,"userId","noticeId","sessionId","presentedAt")
          VALUES ($1,$2,$3,$4,clock_timestamp())`,
          [legacyNotice.presentationId,subjectId,legacyNotice.id,legacyNotice.sessionId]);
        await db.query(`INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","noticePresentationId","grantedAt")
          VALUES ($1,$2,'SELF_ANSWER','PRIVATE','FIXTURE_LEGACY_REGRESSION',$3,$4,clock_timestamp())`,
          [legacyNotice.grantId,subjectId,legacyNotice.hash,legacyNotice.presentationId]);
      }
      const sql = await readFile(`prisma/migrations/${name}/migration.sql`, "utf8");
      await db.query(sql);
    }
    const grants = await db.query<{ consentVersion: number; invitationAcceptanceId: string | null }>(
      `SELECT "consentVersion","invitationAcceptanceId" FROM "ConsentGrant"
       WHERE "subjectId"=$1 AND purpose='BE_PREDICTED' ORDER BY "consentVersion"`, [subjectId],
    );
    if (grants.rows.length !== 2 || grants.rows[0]?.consentVersion !== 1 ||
        grants.rows[1]?.consentVersion !== 2 ||
        grants.rows.some((item) => item.invitationAcceptanceId !== null))
      throw new Error("LEGACY_GRANTS_CHANGED");
    const rowLevelSecurity = await db.query<{ active: boolean }>(
      `SELECT relrowsecurity AS active FROM pg_class WHERE oid='public."ConsentGrant"'::regclass`,
    );
    if (!rowLevelSecurity.rows[0]?.active) throw new Error("READ_BOUNDARY_MISSING");
    const legacyOperational = await db.query<{ allowed: boolean }>(
      `SELECT orvok_radar_consent_operational($1) AS allowed`, [legacyNotice.grantId],
    );
    if (legacyOperational.rows[0]?.allowed !== false) throw new Error("LEGACY_FIXTURE_CONSENT_REUSED");
    const questionId = randomUUID();
    const versionId = randomUUID();
    const optionId = randomUUID();
    await db.query(`INSERT INTO "Question" (id,"stableKey",domain) VALUES ($1,$2,'RADAR')`,
      [questionId,`TEST_ONLY_MIGRATION_REGRESSION_${questionId}`]);
    await db.query(`INSERT INTO "QuestionVersion"
      (id,"questionId",version,text,"familyKey","contentHash","instrumentVersion","catalogStatus","approvedAt")
      VALUES ($1,$2,1,'TEST_ONLY synthetic approved migration fixture','TEST_ONLY_MIGRATION',$3,
        'TEST_ONLY_SYNTHETIC_REGRESSION','APPROVED',clock_timestamp())`,
      [versionId,questionId,"b".repeat(64)]);
    await db.query(`INSERT INTO "AnswerOption" (id,"questionVersionId",code,label,position) VALUES
      ($1,$3,'A','TEST_ONLY A',0),($2,$3,'B','TEST_ONLY B',1)`,
      [optionId,randomUUID(),versionId]);
    await db.query("BEGIN");
    try {
      await db.query("SET LOCAL ROLE orvok_app_runtime");
      await db.query(`SELECT * FROM orvok_radar_answer($1,$2,$3,$4,NULL)`,
        [legacyTokenHash,versionId,optionId,legacyNotice.grantId]);
      throw new Error("LEGACY_FIXTURE_GRANT_AUTHORIZED_NEW_ANSWER");
    } catch (error) {
      if ((error as { code?: string }).code !== "23514") throw error;
    } finally {
      await db.query("ROLLBACK");
    }
    console.log(`incremental database migration: passed (${migrations.length} migrations, legacy grants retained)`);
  } finally {
    await db.end();
  }
} finally {
  if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
}

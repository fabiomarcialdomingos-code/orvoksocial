import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL required");
const prefix = `verify_${randomUUID().replaceAll("-", "")}`;
const incremental = `${prefix}_incremental`;
const admin = new Client({ connectionString: rawUrl });

async function script(path: string): Promise<string> {
  return readFile(path, "utf8");
}

async function withSchema(
  schema: string,
  work: (db: Client) => Promise<void>,
): Promise<void> {
  const db = new Client({
    connectionString: rawUrl,
    options: `-c search_path=${schema},public`,
  });
  await db.connect();
  try {
    await work(db);
  } finally {
    await db.end();
  }
}

await admin.connect();
try {
  await admin.query(`CREATE SCHEMA "${incremental}"`);

  await withSchema(incremental, async (db) => {
    await db.query(
      await script("prisma/migrations/20260922000000_foundation/migration.sql"),
    );
    await db.query(
      await script(
        "prisma/migrations/20260922010000_structural_data/migration.sql",
      ),
    );
    const user = randomUUID();
    await db.query(
      `INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp())`,
      [user],
    );
    await db.query(
      `INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","grantedAt") VALUES ($1,$3,'BE_PREDICTED','PRIVATE','LEGACY',$4,clock_timestamp()),($2,$3,'BE_PREDICTED','PRIVATE','LEGACY',$4,clock_timestamp())`,
      [randomUUID(), randomUUID(), user, "a".repeat(64)],
    );
    const legacySelfGrant = randomUUID();
    await db.query(
      `INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","grantedAt") VALUES ($1,$2,'SELF_ANSWER','PRIVATE','LEGACY',$3,clock_timestamp())`,
      [legacySelfGrant, user, "a".repeat(64)],
    );
    await db.query(
      await script(
        "prisma/migrations/20260922020000_radar_consent_temporal/migration.sql",
      ),
    );
    await db.query(
      await script("prisma/migrations/20260922030000_auth_foundation/migration.sql"),
    );
    await db.query(
      await script("prisma/migrations/20260922040000_operational_registry_requests/migration.sql"),
    );
    await db.query(
      await script("prisma/migrations/20260922050000_notice_hash_integrity/migration.sql"),
    );
    await db.query(
      await script("prisma/migrations/20260922060000_notice_presentation/migration.sql"),
    );
    await db.query(
      await script("prisma/migrations/20260922070000_auth_mail_retry/migration.sql"),
    );
    await db.query(
      await script("prisma/migrations/20260922080000_unique_notice_presentation/migration.sql"),
    );
    await db.query(
      await script("prisma/migrations/20260922090000_self_answer_revocation_guard/migration.sql"),
    );
    await db.query(
      await script("prisma/migrations/20260922100000_radar_rpc_boundary/migration.sql"),
    );
    await db.query(
      await script("prisma/migrations/20260922110000_answer_notice_guard/migration.sql"),
    );
    await db.query(
      await script("prisma/migrations/20260922120000_radar_session_lock/migration.sql"),
    );
    const grants = await db.query<{
      consentVersion: number;
      invitationAcceptanceId: string | null;
    }>(
      `SELECT "consentVersion","invitationAcceptanceId" FROM "ConsentGrant" WHERE "subjectId"=$1 AND purpose='BE_PREDICTED' ORDER BY "consentVersion"`,
      [user],
    );
    if (
      grants.rows.length !== 2 ||
      grants.rows[0]?.consentVersion !== 1 ||
      grants.rows[1]?.consentVersion !== 2 ||
      grants.rows.some((g) => g.invitationAcceptanceId !== null)
    )
      throw new Error("legacy grants changed or silently linked");
    const question = randomUUID();
    const questionVersion = randomUUID();
    const option = randomUUID();
    await db.query(`INSERT INTO "Question" (id,"stableKey",domain) VALUES ($1,$2,'RADAR')`, [question, `fixture_${question}`]);
    await db.query(`INSERT INTO "QuestionVersion" (id,"questionId",version,text,"familyKey","contentHash") VALUES ($1,$2,1,'fixture','fixture',$3)`,
      [questionVersion, question, "a".repeat(64)]);
    await db.query(`INSERT INTO "AnswerOption" (id,"questionVersionId",code,label,position) VALUES ($1,$2,'A','fixture',0)`, [option, questionVersion]);
    try {
      await db.query(`INSERT INTO "AnswerVersion" (id,"subjectId","questionVersionId","optionId","consentGrantId",version,"answeredAt","snapshotHash") VALUES ($1,$2,$3,$4,$5,1,clock_timestamp(),$6)`,
        [randomUUID(), user, questionVersion, option, legacySelfGrant, "a".repeat(64)]);
      throw new Error("legacy self-answer grant unexpectedly authorized new answer");
    } catch (error) {
      if ((error as { code?: string }).code !== "23514") throw error;
    }
  });
  console.log(
    "legacy incremental migration through 120000: passed (grants preserved/versioned)",
  );
} finally {
  await admin.query(`DROP SCHEMA IF EXISTS "${incremental}" CASCADE`);
  await admin.end();
}

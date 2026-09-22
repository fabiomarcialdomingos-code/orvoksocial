import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

if (process.env.ORVOK_REBUILD_TEST_DB !== "1") throw new Error("EXPLICIT_REBUILD_FLAG_REQUIRED");
const ownerUrl = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!ownerUrl) throw new Error("DB_OWNER_URL_REQUIRED");
const source = new URL(ownerUrl);
if (decodeURIComponent(source.pathname.slice(1)) !== "orvok_dev" ||
    !["127.0.0.1", "localhost"].includes(source.hostname) ||
    !["development", "test"].includes(process.env.APP_ENV ?? ""))
  throw new Error("REFUSE_NON_LOCAL_TEST_DATABASE");
const archive = process.argv[2];
const expectedSha = process.argv[3];
if (!archive || !/^[a-f0-9]{64}$/.test(expectedSha ?? "")) throw new Error("VERIFIED_BACKUP_REQUIRED");
const bytes = await readFile(archive);
if (bytes.subarray(0, 5).toString() !== "PGDMP" ||
    createHash("sha256").update(bytes).digest("hex") !== expectedSha)
  throw new Error("BACKUP_INTEGRITY_MISMATCH");
const local = new pg.Client({ connectionString: ownerUrl });
await local.connect();
try {
  const result = await local.query(`SELECT
    (SELECT count(*)::int FROM "AuthIdentity") AS identities,
    (SELECT count(*)::int FROM "AuthSession") AS sessions,
    (SELECT count(*)::int FROM "SocialPredictionSnapshot") AS snapshots,
    (SELECT count(*)::int FROM "DataRequest") AS data_requests,
    (SELECT count(*)::int FROM "QuestionVersion" WHERE "catalogStatus"<>'TEST_ONLY') AS non_fixture_questions,
    (SELECT count(*)::int FROM "QuestionVersion" WHERE text !~* '(TEST_ONLY|FIXTURE|TEST)') AS non_fixture_question_texts,
    (SELECT count(*)::int FROM "ConsentNotice" WHERE content !~* '(TEST_ONLY|FIXTURE|TEST)') AS non_fixture_notice_texts`);
  if (Object.values(result.rows[0] ?? {}).some((value) => value !== 0))
    throw new Error("NON_FIXTURE_DATA_PRESENT_REFUSE_REBUILD");
} finally {
  await local.end();
}
source.pathname = "/postgres";
const admin = new pg.Client({ connectionString: source.toString() });
await admin.connect();
try {
  await admin.query(`DROP DATABASE "orvok_dev" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "orvok_dev"`);
  console.info("Recreated empty local orvok_dev after verifying fixture-only data and backup; apply all migrations before use");
} finally {
  await admin.end();
}

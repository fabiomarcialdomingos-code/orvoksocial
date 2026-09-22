import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");
const database = decodeURIComponent(new URL(connectionString).pathname.slice(1));
if (database !== "orvok_dev") throw new Error("REFUSE_NON_LOCAL_DATABASE");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const summary = await client.query(`SELECT
    (SELECT count(*)::int FROM "User") AS users,
    (SELECT count(*)::int FROM "AuthIdentity") AS identities,
    (SELECT count(*)::int FROM "AuthSession") AS sessions,
    (SELECT count(*)::int FROM "AuthIdentity" WHERE email !~* '(\\@example\\.invalid|\\@orvok\\.test)$') AS unexpected_identity_domains,
    (SELECT count(*)::int FROM "QuestionVersion" WHERE "catalogStatus"<>'TEST_ONLY') AS non_fixture_questions,
    (SELECT count(*)::int FROM "ConsentNotice" WHERE NOT "testOnly" AND version !~ '^FIXTURE|^TEST-') AS non_fixture_notices,
    (SELECT count(*)::int FROM "SocialPredictionSnapshot") AS snapshots,
    (SELECT count(*)::int FROM "DataRequest") AS data_requests,
    (SELECT count(*)::int FROM "QuestionVersion" WHERE text !~* '(TEST_ONLY|FIXTURE|TEST)') AS non_fixture_question_texts,
    (SELECT count(*)::int FROM "ConsentNotice" WHERE content !~* '(TEST_ONLY|FIXTURE|TEST)') AS non_fixture_notice_texts`);
  console.log(JSON.stringify({ database, ...summary.rows[0] }));
} finally {
  await client.end();
}

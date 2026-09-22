import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { z } from "zod";

const option = z.strictObject({ code: z.string().min(1).max(40), label: z.string().min(1), position: z.number().int().min(0) });
const question = z.strictObject({
  stableKey: z.string().min(1).max(120), version: z.number().int().positive(),
  familyKey: z.string().min(1).max(120), text: z.string().min(1), options: z.array(option).min(2).max(20),
});
const manifest = z.strictObject({
  instrumentVersion: z.string().min(1).max(80), status: z.enum(["TEST_ONLY", "CANDIDATE"]),
  questions: z.array(question).min(1).max(100),
});

const path = process.argv[2];
if (!path) throw new Error("MANIFEST_PATH_REQUIRED");
const data = manifest.parse(JSON.parse(await readFile(path, "utf8")));
if (new Set(data.questions.map((item) => item.stableKey)).size !== data.questions.length)
  throw new Error("DUPLICATE_STABLE_KEY");
for (const item of data.questions) {
  if (new Set(item.options.map((value) => value.code)).size !== item.options.length ||
      new Set(item.options.map((value) => value.position)).size !== item.options.length ||
      item.options.some((value, index) => value.position !== index)) throw new Error("INVALID_OPTION_ORDER");
}
const url = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DB_OWNER_URL_REQUIRED");
if (data.status === "TEST_ONLY") {
  if (process.env.ORVOK_ALLOW_TEST_SEED !== "1" ||
      !/(_dev|_test)$/.test(decodeURIComponent(new URL(url).pathname.slice(1))) ||
      process.env.APP_ENV === "staging" || process.env.APP_ENV === "production")
    throw new Error("TEST_ONLY_IMPORT_REQUIRES_LOCAL_TEST_DATABASE");
} else if (process.env.ORVOK_IMPORT_CANDIDATE !== "1") {
  throw new Error("CANDIDATE_IMPORT_REQUIRES_EXPLICIT_FLAG");
}
const pool = new Pool({ connectionString: url });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const item of data.questions) {
    const contentHash = createHash("sha256").update(JSON.stringify({ instrumentVersion: data.instrumentVersion, ...item })).digest("hex");
    const existing = await client.query<{ id: string; domain: string }>(`SELECT id,domain FROM "Question" WHERE "stableKey"=$1 FOR UPDATE`, [item.stableKey]);
    if (existing.rows[0] && existing.rows[0].domain !== "RADAR") throw new Error("QUESTION_DOMAIN_CONFLICT");
    const questionId = existing.rows[0]?.id ?? randomUUID();
    if (!existing.rows[0]) await client.query(`INSERT INTO "Question" (id,"stableKey",domain) VALUES ($1,$2,'RADAR')`, [questionId, item.stableKey]);
    const current = await client.query<{ id: string; contentHash: string; catalogStatus: string }>(
      `SELECT id,"contentHash","catalogStatus" FROM "QuestionVersion" WHERE "questionId"=$1 AND version=$2`, [questionId, item.version],
    );
    if (current.rows[0]) {
      if (current.rows[0].contentHash !== contentHash || current.rows[0].catalogStatus !== data.status)
        throw new Error("FROZEN_VERSION_CONFLICT");
      const frozenOptions = await client.query<{ code: string; label: string; position: number }>(
        `SELECT code,label,position FROM "AnswerOption" WHERE "questionVersionId"=$1 ORDER BY position`,
        [current.rows[0].id],
      );
      if (JSON.stringify(frozenOptions.rows) !== JSON.stringify(item.options))
        throw new Error("FROZEN_OPTIONS_CONFLICT");
      continue;
    }
    const versionId = randomUUID();
    await client.query(`INSERT INTO "QuestionVersion" (id,"questionId",version,text,"familyKey","contentHash","instrumentVersion","catalogStatus")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::"RadarCatalogStatus")`,
      [versionId, questionId, item.version, item.text, item.familyKey, contentHash, data.instrumentVersion, data.status]);
    for (const value of item.options) await client.query(`INSERT INTO "AnswerOption" (id,"questionVersionId",code,label,position)
      VALUES ($1,$2,$3,$4,$5)`, [randomUUID(), versionId, value.code, value.label, value.position]);
  }
  await client.query("COMMIT");
  console.info(`Imported ${data.questions.length} immutable ${data.status} Radar question versions; no official publication`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

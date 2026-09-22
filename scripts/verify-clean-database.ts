import "dotenv/config";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { Client } from "pg";

// Destructive only to the database created by this process. Never run against
// staging/production; this verifies the entire migration chain on public.
if (process.env.APP_ENV !== "test" && process.env.APP_ENV !== "development")
  throw new Error("CLEAN_DATABASE_VERIFIER_LOCAL_OR_CI_ONLY");
const ownerUrl = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!ownerUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = `orvok_verify_${randomUUID().replaceAll("-", "")}`;
const source = new URL(ownerUrl);
const target = new URL(ownerUrl);
target.pathname = `/${databaseName}`;
target.searchParams.set("schema", "public");
const admin = new Client({ connectionString: source.toString() });
let created = false;
await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const migrated = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: target.toString() }, encoding: "utf8",
  });
  if (migrated.status !== 0) throw new Error(`fresh migrate deploy failed: ${migrated.stderr || migrated.stdout}`);
  const db = new Client({ connectionString: target.toString() });
  await db.connect();
  try {
    const result = await db.query<{ migrations: number; tables: number }>(
      `SELECT (SELECT COUNT(*)::integer FROM "_prisma_migrations" WHERE finished_at IS NOT NULL) AS migrations,
              (SELECT COUNT(*)::integer FROM pg_tables WHERE schemaname='public' AND tablename IN
                ('User','AuthIdentity','ConsentGrant','ConsentNotice','SocialPredictionSnapshot')) AS tables`,
    );
    const expected = (await readdir("prisma/migrations", { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).length;
    if (result.rows[0]?.tables !== 5 || result.rows[0]?.migrations !== expected || expected < 13)
      throw new Error("FRESH_DATABASE_INCOMPLETE");
    console.log(`fresh database migration: passed (${expected} migrations, public schema)`);
  } finally {
    await db.end();
  }
} finally {
  if (created) {
    // The name is generated above and never accepts caller input.
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  }
  await admin.end();
}

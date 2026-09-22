import "dotenv/config";
import { randomUUID } from "node:crypto";
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
    let legacyGrants: string[] = [];
    for (const name of migrations) {
      if (name === "20260922020000_radar_consent_temporal") {
        legacyGrants = [randomUUID(), randomUUID()];
        await db.query(`INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp())`, [subjectId]);
        await db.query(`INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","grantedAt") VALUES
          ($1,$3,'BE_PREDICTED','PRIVATE','LEGACY',$4,clock_timestamp()),
          ($2,$3,'BE_PREDICTED','PRIVATE','LEGACY',$4,clock_timestamp())`,
          [legacyGrants[0], legacyGrants[1], subjectId, "a".repeat(64)]);
      }
      const sql = await readFile(`prisma/migrations/${name}/migration.sql`, "utf8");
      await db.query(sql);
    }
    const grants = await db.query<{ consentVersion: number; invitationAcceptanceId: string | null }>(
      `SELECT "consentVersion","invitationAcceptanceId" FROM "ConsentGrant"
       WHERE "subjectId"=$1 ORDER BY "consentVersion"`, [subjectId],
    );
    if (grants.rows.length !== 2 || grants.rows[0]?.consentVersion !== 1 ||
        grants.rows[1]?.consentVersion !== 2 ||
        grants.rows.some((item) => item.invitationAcceptanceId !== null))
      throw new Error("LEGACY_GRANTS_CHANGED");
    const rowLevelSecurity = await db.query<{ active: boolean }>(
      `SELECT relrowsecurity AS active FROM pg_class WHERE oid='public."ConsentGrant"'::regclass`,
    );
    if (!rowLevelSecurity.rows[0]?.active) throw new Error("READ_BOUNDARY_MISSING");
    console.log(`incremental database migration: passed (${migrations.length} migrations, legacy grants retained)`);
  } finally {
    await db.end();
  }
} finally {
  if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
}

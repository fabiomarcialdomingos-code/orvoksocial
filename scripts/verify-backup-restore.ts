import "dotenv/config";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "pg";

if (process.env.APP_ENV !== "test" && process.env.APP_ENV !== "development")
  throw new Error("BACKUP_RESTORE_VERIFIER_LOCAL_OR_CI_ONLY");
const ownerUrl = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!ownerUrl) throw new Error("DATABASE_URL_REQUIRED");
const source = new URL(ownerUrl);
const tempName = `orvok_restore_${randomUUID().replaceAll("-", "")}`;
const archive = resolve(join(tmpdir(), `${tempName}.dump`));
if (!archive.startsWith(resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/")))
  throw new Error("BACKUP_PATH_OUTSIDE_TEMP");
const pgBin = process.platform === "win32" ? "C:\\Program Files\\PostgreSQL\\18\\bin\\" : "";
const executable = (name: string) => `${pgBin}${name}${process.platform === "win32" ? ".exe" : ""}`;
const pgEnv = {
  ...process.env,
  PGHOST: source.hostname,
  PGPORT: source.port || "5432",
  PGUSER: decodeURIComponent(source.username),
  PGPASSWORD: decodeURIComponent(source.password),
  PGDATABASE: decodeURIComponent(source.pathname.slice(1)),
};
const admin = new Client({ connectionString: ownerUrl });
let createdDatabase = false;
let createdArchive = false;
await admin.connect();
try {
  const before = await admin.query<{ users: number; grants: number; migrations: number }>(
    `SELECT (SELECT COUNT(*)::integer FROM "User") AS users,
            (SELECT COUNT(*)::integer FROM "ConsentGrant") AS grants,
            (SELECT COUNT(*)::integer FROM "_prisma_migrations" WHERE finished_at IS NOT NULL) AS migrations`,
  );
  const dump = spawnSync(executable("pg_dump"), ["--format=custom", "--file", archive, "--no-owner", "--no-acl"], {
    env: pgEnv, encoding: "utf8",
  });
  if (dump.status !== 0) throw new Error(`pg_dump failed: ${dump.stderr || dump.stdout}`);
  createdArchive = true;
  await admin.query(`CREATE DATABASE "${tempName}"`);
  createdDatabase = true;
  const restore = spawnSync(executable("pg_restore"), ["--dbname", tempName, "--no-owner", "--no-acl", archive], {
    env: pgEnv, encoding: "utf8",
  });
  if (restore.status !== 0) throw new Error(`pg_restore failed: ${restore.stderr || restore.stdout}`);
  const restoredUrl = new URL(ownerUrl);
  restoredUrl.pathname = `/${tempName}`;
  const restored = new Client({ connectionString: restoredUrl.toString() });
  await restored.connect();
  try {
    const after = await restored.query<{ users: number; grants: number; migrations: number }>(
      `SELECT (SELECT COUNT(*)::integer FROM "User") AS users,
              (SELECT COUNT(*)::integer FROM "ConsentGrant") AS grants,
              (SELECT COUNT(*)::integer FROM "_prisma_migrations" WHERE finished_at IS NOT NULL) AS migrations`,
    );
    if (JSON.stringify(before.rows[0]) !== JSON.stringify(after.rows[0]))
      throw new Error("RESTORE_COUNTS_MISMATCH");
    console.log(`backup/restore rehearsal: passed (${after.rows[0]?.migrations} migrations, users/grants preserved)`);
  } finally {
    await restored.end();
  }
} finally {
  if (createdDatabase) await admin.query(`DROP DATABASE "${tempName}" WITH (FORCE)`);
  await admin.end();
  if (createdArchive) await unlink(archive);
}

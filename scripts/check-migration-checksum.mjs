import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const name = process.argv[2];
if (!/^20[0-9]{12}_[a-z0-9_]+$/.test(name ?? "")) throw new Error("MIGRATION_NAME_REQUIRED");
const bytes = readFileSync(`prisma/migrations/${name}/migration.sql`);
const fileChecksum = createHash("sha256").update(bytes).digest("hex");
const database = new Client({ connectionString: process.env.DATABASE_URL });
try {
  await database.connect();
  const result = await database.query("SELECT checksum FROM _prisma_migrations WHERE migration_name=$1", [name]);
  const appliedChecksum = result.rows[0]?.checksum;
  console.log(JSON.stringify({ name, fileChecksum, appliedChecksum, match: fileChecksum === appliedChecksum }));
  if (!appliedChecksum || fileChecksum !== appliedChecksum) process.exitCode = 1;
} finally {
  await database.end();
}

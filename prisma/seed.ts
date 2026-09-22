import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";

// Explicitly test-only. No personal user or official question is created.
const ownerUrl = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!ownerUrl) throw new Error("DB_OWNER_URL_REQUIRED");
if (process.env.ORVOK_ALLOW_TEST_SEED !== "1" ||
    !/(_dev|_test)$/.test(decodeURIComponent(new URL(ownerUrl).pathname.slice(1))) ||
    process.env.APP_ENV === "staging" || process.env.APP_ENV === "production")
  throw new Error("TEST_ONLY_SEED_REQUIRES_LOCAL_TEST_DATABASE");

const pool = new Pool({ connectionString: ownerUrl });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`UPDATE "RadarCatalogControl" SET "allowTestOnly"=true,"updatedAt"=clock_timestamp() WHERE id=1`);
  const administratorId = "00000000-0000-4000-8000-000000000001";
  await client.query(`INSERT INTO "User" (id,role,"updatedAt") VALUES ($1,'ADMIN',clock_timestamp()) ON CONFLICT (id) DO NOTHING`, [administratorId]);
  for (const purpose of ["SELF_ANSWER", "BE_PREDICTED"] as const) {
    const version = `TEST_ONLY_${purpose}_V1`;
    const content = `TEST_ONLY — aviso fictício de ${purpose}. Uso exclusivo em desenvolvimento/testes; não é aviso legal aprovado para pessoas reais.`;
    const hash = createHash("sha256").update(content).digest("hex");
    const existing = await client.query<{ contentHash: string; testOnly: boolean }>(
      `SELECT "contentHash","testOnly" FROM "ConsentNotice" WHERE purpose=$1 AND version=$2`, [purpose, version],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].contentHash !== hash || !existing.rows[0].testOnly) throw new Error("TEST_NOTICE_VERSION_CONFLICT");
      continue;
    }
    await client.query(`INSERT INTO "ConsentNotice"
      (id,purpose,version,content,"contentHash",status,"approvedAt","approvedById","testOnly")
      VALUES ($1,$2,$3,$4,$5,'APPROVED',clock_timestamp(),$6,true)`,
      [randomUUID(), purpose, version, content, hash, administratorId]);
  }
  await client.query("COMMIT");
  console.info("Enabled TEST_ONLY Radar catalog and fictitious notices in local test database only");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

import "dotenv/config";
import { Client } from "pg";
import { parseServerEnv } from "../src/lib/env";

const env = parseServerEnv(process.env);
const client = new Client({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});

try {
  await client.connect();
  const result = await client.query<{
    server_version: string;
    applied: number;
  }>(
    `SELECT current_setting('server_version') AS server_version,
            (SELECT count(*)::int FROM "_prisma_migrations" WHERE finished_at IS NOT NULL) AS applied`,
  );
  const row = result.rows[0];
  if (!row || row.applied < 1)
    throw new Error("Foundation migration not applied");
  console.info(
    `PostgreSQL ${row.server_version}; applied migrations: ${row.applied}`,
  );
} finally {
  await client.end();
}

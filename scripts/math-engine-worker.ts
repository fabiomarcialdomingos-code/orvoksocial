import "dotenv/config";
import { Pool } from "pg";
import { MathPersistence } from "../src/lib/math/persistence";

const connectionString = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DB_OWNER_URL_REQUIRED");
const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 3000 });
const service = new MathPersistence(pool);
const once = process.env.MATH_WORKER_ONCE !== "0";

try {
  do {
    const processed = await service.processPending(Number(process.env.MATH_WORKER_BATCH ?? 10));
    if (processed.length) console.log(JSON.stringify({ worker: "math-engine-v1", processed }));
    if (once || processed.length === 0) break;
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.MATH_WORKER_INTERVAL_MS ?? 1000)));
  } while (true);
} finally {
  await pool.end();
}

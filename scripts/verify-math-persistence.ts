import "dotenv/config";
import { Pool } from "pg";
import { MathPersistence } from "../src/lib/math/persistence";

const url = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DB_OWNER_URL_REQUIRED");
const pool = new Pool({ connectionString: url });
const service = new MathPersistence(pool);
const suffix = Date.now().toString();
try {
  const users = await pool.query<{ id: string }>(`SELECT id FROM "User" ORDER BY "createdAt" LIMIT 2`);
  if (users.rows.length < 2) throw new Error("TWO_USERS_REQUIRED");
  const world = await service.enqueue("WORLD", { subjectKey: `verify:${suffix}`, predictions: [0.2, 0.8, 0.7, 0.1], outcomes: [0, 1, 1, 0], nEff: 4 }, `verify-world:${suffix}`);
  const duplicate = await service.enqueue("WORLD", { subjectKey: `verify:${suffix}`, predictions: [0.2, 0.8, 0.7, 0.1], outcomes: [0, 1, 1, 0], nEff: 4 }, `verify-world:${suffix}`);
  if (world.id !== duplicate.id || !duplicate.existing) throw new Error("IDEMPOTENCY_FAILED");
  await service.enqueue("CONSENSUS", { subjectKey: `verify-consensus:${suffix}`, inputs: [0, 1, 2, 3, 4].map((id) => ({ predictorId: String(id), probability: 0.2 + id * 0.1 })) }, `verify-consensus:${suffix}`);
  await service.enqueue("RADAR", { predictorId: users.rows[0]!.id, targetId: users.rows[1]!.id, pairs: [0, 1, 2, 3].map((id) => ({ predictorId: users.rows[0]!.id, targetId: users.rows[1]!.id, predicted: 0.2 + id * 0.15, actual: 0.3 + id * 0.1 })) }, `verify-radar:${suffix}`);
  const processed = await service.processPending(10);
  if (processed.filter((item) => item.status === "COMPLETED").length !== 3) throw new Error("PROCESSING_FAILED");
  const reprocess = await service.requestReprocess(`verify:${suffix}`, "WORLD", { subjectKey: `verify:${suffix}`, predictions: [0.25, 0.75], outcomes: [0, 1] }, users.rows[0]!.id, "verification correction");
  const reprocessed = await service.processPending(1);
  if (!reprocessed.some((item) => item.id === reprocess.jobId && item.status === "COMPLETED")) throw new Error("REPROCESSING_FAILED");
  const bad = await service.enqueue("WORLD", { subjectKey: `verify-bad:${suffix}`, predictions: [0.5], outcomes: [] as (0 | 1)[] }, `verify-bad:${suffix}`);
  const failed = await service.processOne();
  if (!failed || failed.status !== "RETRY") throw new Error("RETRY_FAILED");
  await pool.query(`UPDATE "MathProcessingJob" SET "nextAttemptAt"=clock_timestamp(),attempts=5 WHERE id=$1`, [bad.id]);
  const dead = await service.processOne();
  if (!dead || dead.status !== "DEAD") throw new Error("DEAD_LETTER_FAILED");
  const counts = await pool.query<{ runs: string; scores: string; consensus: string; radar: string }>(`SELECT (SELECT count(*) FROM "MathCalculationRun" WHERE "inputManifestHash" IS NOT NULL)::text AS runs,(SELECT count(*) FROM "MathScoreSnapshot")::text AS scores,(SELECT count(*) FROM "MathConsensusSnapshot")::text AS consensus,(SELECT count(*) FROM "MathRadarSnapshot")::text AS radar`);
  console.log(JSON.stringify({ ok: true, processed, counts: counts.rows[0] }));
} finally {
  await pool.end();
}

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { publishMathEventAtomic } from "../src/lib/math/orchestration";
import { MathPersistence } from "../src/lib/math/persistence";

const url = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DB_OWNER_URL_REQUIRED");
const pool = new Pool({ connectionString: url });
const service = new MathPersistence(pool);
const aggregateId = randomUUID();
try {
  const result = await publishMathEventAtomic(pool, {
    eventType: "WORLD_EVENT_RESOLVED", aggregateType: "WorldEvent", aggregateId,
    payload: { source: "orchestration-verification" },
    idempotencyKey: "orchestration-verification:" + aggregateId,
    job: { kind: "WORLD", payload: { subjectKey: "orchestration-verification:" + aggregateId, predictions: [0.2, 0.8], outcomes: [0, 1], nEff: 2 } },
  });
  const processed = await service.processPending(1);
  const check = await pool.query<{ eventStatus: string; jobCount: string }>("SELECT e.status AS \"eventStatus\",(SELECT count(*)::text FROM \"MathProcessingJob\" j WHERE j.\"domainEventId\"=e.id) AS \"jobCount\" FROM \"MathDomainEvent\" e WHERE e.id=$1", [result.eventId]);
  if (processed[0]?.status !== "COMPLETED" || check.rows[0]?.eventStatus !== "DISPATCHED" || check.rows[0]?.jobCount !== "1") throw new Error("OUTBOX_FLOW_FAILED");
  console.log(JSON.stringify({ ok: true, eventId: result.eventId, jobId: result.jobId, processed: processed[0] }));
} finally { await pool.end(); }

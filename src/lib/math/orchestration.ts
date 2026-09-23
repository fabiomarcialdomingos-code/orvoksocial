import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { MathJobKind, MathJobPayload, RadarJobPayload, WorldJobPayload } from "./persistence";

type EventInput = {
  eventType: string; aggregateType: string; aggregateId: string;
  payload: Record<string, unknown>; idempotencyKey: string;
  job?: { kind: MathJobKind; payload: MathJobPayload; idempotencyKey?: string };
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function publishMathEvent(client: PoolClient, input: EventInput): Promise<{ eventId: string; jobId: string | null }> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["math-event:" + input.aggregateType + ":" + input.aggregateId]);
  const sequence = await client.query<{ next: string }>("SELECT COALESCE(MAX(sequence),0)+1 AS next FROM \"MathDomainEvent\" WHERE \"aggregateType\"=$1 AND \"aggregateId\"=$2", [input.aggregateType, input.aggregateId]);
  const eventId = randomUUID();
  const inserted = await client.query<{ id: string }>("INSERT INTO \"MathDomainEvent\" (id,\"eventType\",\"aggregateType\",\"aggregateId\",sequence,payload,\"idempotencyKey\") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (\"idempotencyKey\") DO UPDATE SET \"idempotencyKey\"=EXCLUDED.\"idempotencyKey\" RETURNING id", [eventId, input.eventType, input.aggregateType, input.aggregateId, sequence.rows[0]!.next, JSON.stringify(input.payload), input.idempotencyKey]);
  const actualEventId = inserted.rows[0]!.id;
  if (!input.job) return { eventId: actualEventId, jobId: null };
  const jobId = randomUUID();
  const jobKey = input.job.idempotencyKey ?? input.idempotencyKey + ":job";
  const job = await client.query<{ id: string }>("INSERT INTO \"MathProcessingJob\" (id,kind,\"idempotencyKey\",payload,\"domainEventId\") VALUES ($1,$2,$3,$4,$5) ON CONFLICT (\"idempotencyKey\") DO UPDATE SET \"idempotencyKey\"=EXCLUDED.\"idempotencyKey\" RETURNING id", [jobId, input.job.kind, jobKey, JSON.stringify(input.job.payload), actualEventId]);
  await client.query("UPDATE \"MathDomainEvent\" SET status='DISPATCHED',\"dispatchedAt\"=clock_timestamp() WHERE id=$1", [actualEventId]);
  return { eventId: actualEventId, jobId: job.rows[0]!.id };
}

export async function publishMathEventAtomic(pool: Pool, input: EventInput): Promise<{ eventId: string; jobId: string | null }> {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await publishMathEvent(client, input); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function enqueueRadarSnapshot(pool: Pool, snapshotId: string, eventType = "RADAR_SNAPSHOT_CREATED"): Promise<{ eventId: string; jobId: string | null } | null> {
  const row = await pool.query<{ predictorId: string; targetId: string; probabilityVector: unknown; answerPosition: number | null }>("SELECT s.\"predictorId\",s.\"targetId\",s.\"probabilityVector\",o.position AS \"answerPosition\" FROM \"SocialPredictionSnapshot\" s JOIN \"AnswerVersion\" a ON a.id=s.\"answerVersionId\" JOIN \"AnswerOption\" o ON o.id=a.\"optionId\" AND o.\"questionVersionId\"=a.\"questionVersionId\" WHERE s.id=$1", [snapshotId]);
  const item = row.rows[0]; if (!item || item.answerPosition === null) return null;
  const vector = Array.isArray(item.probabilityVector) ? item.probabilityVector.map(Number) : [];
  const payload: RadarJobPayload = { predictorId: item.predictorId, targetId: item.targetId, pairs: [{ predictorId: item.predictorId, targetId: item.targetId, predicted: vector[item.answerPosition] ?? 0, actual: 1 }] };
  return publishMathEventAtomic(pool, { eventType, aggregateType: "SocialPredictionSnapshot", aggregateId: snapshotId, payload: { snapshotId }, idempotencyKey: eventType + ":" + snapshotId + ":" + hash(payload), job: { kind: "RADAR", payload } });
}

export async function enqueueWorldResolution(client: PoolClient, eventId: string, outcomeOpportunityId: string | null, state: string, rationale: string): Promise<Array<{ eventId: string; jobId: string | null }>> {
  const result = await client.query<{ predictorId: string; confidence: number; opportunityId: string }>("SELECT \"predictorId\",confidence,\"opportunityId\" FROM \"WorldPrediction\" WHERE \"eventId\"=$1", [eventId]);
  const grouped = new Map<string, { predictions: number[]; outcomes: (0 | 1)[] }>();
  for (const item of result.rows) { const group = grouped.get(item.predictorId) ?? { predictions: [], outcomes: [] }; group.predictions.push(Number(item.confidence)); group.outcomes.push(outcomeOpportunityId && item.opportunityId === outcomeOpportunityId ? 1 : 0); grouped.set(item.predictorId, group); }
  const events: Array<{ eventId: string; jobId: string | null }> = [];
  for (const [predictorId, values] of grouped) {
    const payload: WorldJobPayload = { subjectKey: predictorId, predictions: values.predictions, outcomes: values.outcomes, nEff: values.predictions.length };
    const input: EventInput = { eventType: state === "CANCELLED" || state === "VOID" ? "WORLD_EVENT_CANCELLED" : "WORLD_EVENT_RESOLVED", aggregateType: "WorldEvent", aggregateId: eventId, payload: { state, rationale, predictorId }, idempotencyKey: "world-resolution:" + eventId + ":" + state + ":" + predictorId + ":" + hash(payload) };
    if (state !== "CANCELLED" && state !== "VOID") input.job = { kind: "WORLD", payload, idempotencyKey: "world-score:" + eventId + ":" + predictorId + ":" + hash(payload) };
    events.push(await publishMathEvent(client, input));
  }
  return events;
}

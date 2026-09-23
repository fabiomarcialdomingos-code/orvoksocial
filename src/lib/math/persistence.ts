import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  CONSENSUS_ALGORITHM_VERSION,
  ENGINE_VERSION,
  RADAR_ALGORITHM_VERSION,
  WORLD_ALGORITHM_VERSION,
  consensusLeaveOneOut,
  estimateRadar,
  scoreWorldBinary,
} from "../math-engine";

export type MathJobKind = "WORLD" | "CONSENSUS" | "RADAR" | "REPROCESS";
export type WorldJobPayload = { subjectKey: string; predictions: number[]; outcomes: (0 | 1)[]; nEff?: number; category?: string; ranking?: { subjectKey: string; value: number; rank: number; category?: string }[] };
export type ConsensusJobPayload = { subjectKey: string; eventId?: string; inputs: { predictorId: string; probability: number }[]; excludedPredictorId?: string };
export type RadarJobPayload = { predictorId: string; targetId: string; pairs: { predictorId: string; targetId: string; predicted: number; actual: number; weight?: number }[]; tauSquared?: number };
export type MathJobPayload = WorldJobPayload | ConsensusJobPayload | RadarJobPayload | { sourceKey: string; original: MathJobKind; payload: WorldJobPayload | ConsensusJobPayload | RadarJobPayload };

type ClaimedJob = { id: string; kind: MathJobKind; payload: MathJobPayload; attempts: number };

function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function algorithmFor(kind: Exclude<MathJobKind, "REPROCESS">): { domain: string; version: string; parameters: Record<string, unknown> } {
  if (kind === "WORLD") return { domain: "WORLD", version: WORLD_ALGORITHM_VERSION, parameters: { outcomeModel: "binary", baseline: "empirical-climatology" } };
  if (kind === "CONSENSUS") return { domain: "CONSENSUS", version: CONSENSUS_ALGORITHM_VERSION, parameters: { quorum: 5, pooling: "log-odds", leaveOneOut: true, clipMin: 0.05, clipMax: 0.95 } };
  return { domain: "RADAR", version: RADAR_ALGORITHM_VERSION, parameters: { model: "z_ij=mu+alpha_i+beta_j+gamma_ij+epsilon_ij", shrinkage: "versioned-engine", ci: "normal-95" } };
}

export class MathPersistence {
  constructor(private readonly pool: Pool) {}

  async enqueue(kind: MathJobKind, payload: MathJobPayload, idempotencyKey: string, maxAttempts = 5): Promise<{ id: string; existing: boolean }> {
    const id = randomUUID();
    const result = await this.pool.query<{ id: string; inserted: boolean }>(
      `INSERT INTO "MathProcessingJob" (id,kind,"idempotencyKey",payload,"maxAttempts") VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT ("idempotencyKey") DO UPDATE SET "idempotencyKey"=EXCLUDED."idempotencyKey"
       RETURNING id, (xmax=0) AS inserted`, [id, kind, idempotencyKey, JSON.stringify(payload), maxAttempts],
    );
    return { id: result.rows[0]!.id, existing: !result.rows[0]!.inserted };
  }

  private async claim(): Promise<ClaimedJob | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query<{ id: string; kind: MathJobKind; payload: MathJobPayload; attempts: number }>(
        `SELECT id,kind,payload,attempts FROM "MathProcessingJob"
         WHERE status='PENDING' AND "nextAttemptAt"<=clock_timestamp()
         ORDER BY "createdAt",id FOR UPDATE SKIP LOCKED LIMIT 1`,
      );
      const row = found.rows[0];
      if (!row) { await client.query("COMMIT"); return null; }
      await client.query(`UPDATE "MathProcessingJob" SET status='RUNNING',attempts=attempts+1,"lockedAt"=clock_timestamp() WHERE id=$1`, [row.id]);
      await client.query("COMMIT");
      return { ...row, attempts: row.attempts + 1 };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  private async run(client: PoolClient, kind: Exclude<MathJobKind, "REPROCESS">, payload: WorldJobPayload | ConsensusJobPayload | RadarJobPayload): Promise<string> {
    const algorithm = algorithmFor(kind);
    const inputManifestHash = hashInput(payload);
    await client.query(
      `INSERT INTO "MathAlgorithmVersion" (id,"engineVersion","algorithmVersion",domain,parameters,"publishedForCalculation")
       VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT ("engineVersion","algorithmVersion") DO NOTHING`,
      [randomUUID(), ENGINE_VERSION, algorithm.version, algorithm.domain, JSON.stringify(algorithm.parameters)],
    );
    const version = await client.query<{ id: string }>(`SELECT id FROM "MathAlgorithmVersion" WHERE "engineVersion"=$1 AND "algorithmVersion"=$2`, [ENGINE_VERSION, algorithm.version]);
    const existing = await client.query<{ id: string }>(`SELECT id FROM "MathCalculationRun" WHERE "algorithmVersionId"=$1 AND "inputManifestHash"=$2 AND status='COMPLETED'`, [version.rows[0]!.id, inputManifestHash]);
    if (existing.rows[0]) return existing.rows[0].id;
    const runId = randomUUID();
    await client.query(
      `INSERT INTO "MathCalculationRun" (id,"algorithmVersionId",domain,"asOf","inputManifestHash","parameterSnapshot",status) VALUES ($1,$2,$3,clock_timestamp(),$4,$5,'COMPLETED')`,
      [runId, version.rows[0]!.id, algorithm.domain, inputManifestHash, JSON.stringify(algorithm.parameters)],
    );
    if (kind === "WORLD") {
      const data = payload as WorldJobPayload;
      const value = scoreWorldBinary(data.predictions, data.outcomes, data.nEff ?? data.predictions.length);
      const snapshotHash = hashInput({ runId, value });
      await client.query(`INSERT INTO "MathScoreSnapshot" (id,"calculationRunId","subjectKey",score,baseline,gain,"nEff",margin,state,"snapshotHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [randomUUID(), runId, data.subjectKey, value.score, value.baseline, value.gain, value.nEff, value.margin, value.state, snapshotHash]);
      for (const rank of data.ranking ?? []) await client.query(`INSERT INTO "MathRankingSnapshot" (id,"calculationRunId","subjectKey",rank,category,value) VALUES ($1,$2,$3,$4,$5,$6)`, [randomUUID(), runId, rank.subjectKey, rank.rank, rank.category ?? null, rank.value]);
      await client.query(`INSERT INTO "MathReputationSnapshot" (id,"calculationRunId","subjectKey",value,"evidenceState","sourceSnapshotIds") VALUES ($1,$2,$3,$4,$5,$6)`, [randomUUID(), runId, data.subjectKey, value.gain, value.state, JSON.stringify([])]);
    } else if (kind === "CONSENSUS") {
      const data = payload as ConsensusJobPayload;
      const probability = consensusLeaveOneOut(data.inputs, data.excludedPredictorId);
      if (probability !== null) await client.query(`INSERT INTO "MathConsensusSnapshot" (id,"calculationRunId","eventId","subjectKey","excludedPredictorId",probability,"nInput","quorumMet","snapshotHash") VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)`, [randomUUID(), runId, data.eventId ?? null, data.subjectKey, data.excludedPredictorId ?? null, probability, data.inputs.length - (data.excludedPredictorId ? 1 : 0), hashInput({ runId, probability })]);
    } else {
      const data = payload as RadarJobPayload;
      const value = estimateRadar(data.pairs, data.tauSquared);
      await client.query(`INSERT INTO "MathRadarSnapshot" (id,"calculationRunId","predictorId","targetId","nEff","rA","rB","daPreliminary",alpha,beta,gamma,"gammaCi95","shrinkageParameters",state,"snapshotHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [randomUUID(), runId, data.predictorId, data.targetId, value.nEff, value.rA, value.rB, value.da, value.alpha, value.beta, value.gamma, value.gammaCi95 ? JSON.stringify(value.gammaCi95) : null, JSON.stringify(value.parameters), value.state, hashInput({ runId, value })]);
    }
    return runId;
  }

  async processOne(): Promise<{ id: string; status: "COMPLETED" | "RETRY" | "DEAD" } | null> {
    const job = await this.claim();
    if (!job) return null;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const kind = job.kind === "REPROCESS" ? (job.payload as { original: Exclude<MathJobKind, "REPROCESS"> }).original : job.kind;
      const payload = job.kind === "REPROCESS" ? (job.payload as { payload: WorldJobPayload | ConsensusJobPayload | RadarJobPayload }).payload : job.payload;
      await this.run(client, kind, payload as never);
      await client.query(`UPDATE "MathProcessingJob" SET status='COMPLETED',"completedAt"=clock_timestamp(),"lockedAt"=NULL WHERE id=$1`, [job.id]);
      await client.query("COMMIT");
      return { id: job.id, status: "COMPLETED" };
    } catch (error) {
      await client.query("ROLLBACK");
      const message = error instanceof Error ? error.message.slice(0, 1000) : "UNKNOWN_ERROR";
      const dead = job.attempts >= 5;
      await this.pool.query(`UPDATE "MathProcessingJob" SET status=$2,"lastError"=$3,"nextAttemptAt"=clock_timestamp()+($4||' seconds')::interval,"lockedAt"=NULL WHERE id=$1`, [job.id, dead ? "DEAD" : "PENDING", message, String(Math.min(3600, 2 ** job.attempts))]);
      return { id: job.id, status: dead ? "DEAD" : "RETRY" };
    } finally { client.release(); }
  }

  async processPending(limit = 10): Promise<Array<{ id: string; status: string }>> {
    const result: Array<{ id: string; status: string }> = [];
    for (let index = 0; index < limit; index += 1) { const item = await this.processOne(); if (!item) break; result.push(item); }
    return result;
  }

  async requestReprocess(sourceKey: string, kind: Exclude<MathJobKind, "REPROCESS">, payload: MathJobPayload, operatorId: string, reason: string): Promise<{ requestId: string; jobId: string }> {
    const job = await this.enqueue("REPROCESS", { sourceKey, original: kind, payload } as never, `reprocess:${sourceKey}:${hashInput({ kind, payload })}`);
    const requestId = randomUUID();
    await this.pool.query(`INSERT INTO "MathReprocessRequest" (id,"sourceKey",reason,"operatorId","jobId") VALUES ($1,$2,$3,$4,$5)`, [requestId, sourceKey, reason, operatorId, job.id]);
    return { requestId, jobId: job.id };
  }
}

export function mathOwnerPool(): Pool {
  throw new Error("MATH_OWNER_POOL_REQUIRED_USE_WORKER");
}

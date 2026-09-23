-- Operational persistence for the canonical Math Engine V1.
CREATE TABLE "MathProcessingJob" (
  id uuid PRIMARY KEY,
  kind varchar(40) NOT NULL CHECK (kind IN ('WORLD','CONSENSUS','RADAR','REPROCESS')),
  "idempotencyKey" varchar(180) NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','DEAD')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  "maxAttempts" integer NOT NULL DEFAULT 5 CHECK ("maxAttempts" > 0),
  "nextAttemptAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  "lockedAt" timestamptz(6),
  "lastError" text,
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  "completedAt" timestamptz(6)
);
CREATE INDEX "MathProcessingJob_ready_idx" ON "MathProcessingJob" (status, "nextAttemptAt", "createdAt");

CREATE TABLE "MathRankingSnapshot" (
  id uuid PRIMARY KEY,
  "calculationRunId" uuid NOT NULL REFERENCES "MathCalculationRun"(id) ON DELETE RESTRICT,
  "subjectKey" varchar(160) NOT NULL,
  rank integer NOT NULL CHECK (rank > 0),
  category varchar(120),
  value numeric(16,12) NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "MathRankingSnapshot_lookup_idx" ON "MathRankingSnapshot" (category, rank, "createdAt");

CREATE TABLE "MathReputationSnapshot" (
  id uuid PRIMARY KEY,
  "calculationRunId" uuid NOT NULL REFERENCES "MathCalculationRun"(id) ON DELETE RESTRICT,
  "subjectKey" varchar(160) NOT NULL,
  value numeric(16,12) NOT NULL,
  "evidenceState" "EvidenceState" NOT NULL,
  "sourceSnapshotIds" jsonb NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "MathReputationSnapshot_lookup_idx" ON "MathReputationSnapshot" ("subjectKey", "createdAt");

CREATE TABLE "MathReprocessRequest" (
  id uuid PRIMARY KEY,
  "sourceKey" varchar(180) NOT NULL,
  reason varchar(500) NOT NULL,
  "operatorId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "requestedAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  "jobId" uuid REFERENCES "MathProcessingJob"(id) ON DELETE RESTRICT
);

CREATE TRIGGER "MathProcessingJob_no_delete" BEFORE DELETE ON "MathProcessingJob" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "MathRankingSnapshot_no_update" BEFORE UPDATE OR DELETE ON "MathRankingSnapshot" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "MathReputationSnapshot_no_update" BEFORE UPDATE OR DELETE ON "MathReputationSnapshot" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "MathReprocessRequest_no_update" BEFORE UPDATE OR DELETE ON "MathReprocessRequest" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orvok_app_runtime') THEN
    GRANT SELECT ON "MathAlgorithmVersion", "MathCalculationRun", "MathConsensusSnapshot", "MathScoreSnapshot", "MathRadarSnapshot", "MathRankingSnapshot", "MathReputationSnapshot" TO orvok_app_runtime;
    GRANT INSERT ON "MathProcessingJob" TO orvok_app_runtime;
  END IF;
END $$;

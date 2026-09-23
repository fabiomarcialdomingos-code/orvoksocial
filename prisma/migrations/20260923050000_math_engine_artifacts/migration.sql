-- MATH ENGINE V1: internal, versioned artifacts. No publication or ranking grants.
CREATE TABLE "MathAlgorithmVersion" (
  id uuid PRIMARY KEY,
  "engineVersion" varchar(80) NOT NULL,
  "algorithmVersion" varchar(120) NOT NULL,
  domain varchar(20) NOT NULL CHECK (domain IN ('WORLD','CONSENSUS','RADAR')),
  "parameters" jsonb NOT NULL,
  "publishedForCalculation" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("engineVersion", "algorithmVersion")
);

CREATE TABLE "MathCalculationRun" (
  id uuid PRIMARY KEY,
  "algorithmVersionId" uuid NOT NULL REFERENCES "MathAlgorithmVersion"(id) ON DELETE RESTRICT,
  domain varchar(20) NOT NULL CHECK (domain IN ('WORLD','CONSENSUS','RADAR')),
  "asOf" timestamptz(6) NOT NULL,
  "inputManifestHash" varchar(64) NOT NULL,
  "parameterSnapshot" jsonb NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('COMPLETED','REJECTED','FAILED')),
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE "MathConsensusSnapshot" (
  id uuid PRIMARY KEY,
  "calculationRunId" uuid NOT NULL REFERENCES "MathCalculationRun"(id) ON DELETE RESTRICT,
  "eventId" uuid,
  "subjectKey" varchar(160) NOT NULL,
  "excludedPredictorId" uuid,
  probability numeric(12,10) NOT NULL CHECK (probability >= 0.05 AND probability <= 0.95),
  "nInput" integer NOT NULL CHECK ("nInput" >= 0),
  "quorumMet" boolean NOT NULL,
  "snapshotHash" varchar(64) NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("calculationRunId", "subjectKey", "excludedPredictorId")
);

CREATE TABLE "MathScoreSnapshot" (
  id uuid PRIMARY KEY,
  "calculationRunId" uuid NOT NULL REFERENCES "MathCalculationRun"(id) ON DELETE RESTRICT,
  "subjectKey" varchar(160) NOT NULL,
  score numeric(16,12) NOT NULL,
  baseline numeric(16,12) NOT NULL,
  gain numeric(16,12) NOT NULL,
  "nEff" numeric(16,8) NOT NULL CHECK ("nEff" >= 0),
  margin numeric(16,12),
  state "EvidenceState" NOT NULL,
  "snapshotHash" varchar(64) NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("calculationRunId", "subjectKey")
);

CREATE TABLE "MathRadarSnapshot" (
  id uuid PRIMARY KEY,
  "calculationRunId" uuid NOT NULL REFERENCES "MathCalculationRun"(id) ON DELETE RESTRICT,
  "predictorId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "targetId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "nEff" numeric(16,8) NOT NULL CHECK ("nEff" >= 0),
  "rA" integer NOT NULL CHECK ("rA" >= 0),
  "rB" integer NOT NULL CHECK ("rB" >= 0),
  "daPreliminary" numeric(16,12),
  "alpha" numeric(16,12) NOT NULL,
  "beta" numeric(16,12) NOT NULL,
  "gamma" numeric(16,12) NOT NULL,
  "gammaCi95" jsonb,
  "shrinkageParameters" jsonb NOT NULL,
  state "EvidenceState" NOT NULL,
  "snapshotHash" varchar(64) NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CHECK ("predictorId" <> "targetId"),
  UNIQUE ("calculationRunId", "predictorId", "targetId")
);

CREATE INDEX "MathCalculationRun_domain_asOf_idx" ON "MathCalculationRun" (domain, "asOf");
CREATE INDEX "MathScoreSnapshot_subjectKey_createdAt_idx" ON "MathScoreSnapshot" ("subjectKey", "createdAt");
CREATE INDEX "MathRadarSnapshot_pair_createdAt_idx" ON "MathRadarSnapshot" ("predictorId", "targetId", "createdAt");

CREATE TRIGGER "MathAlgorithmVersion_no_update" BEFORE UPDATE OR DELETE ON "MathAlgorithmVersion" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "MathCalculationRun_no_update" BEFORE UPDATE OR DELETE ON "MathCalculationRun" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "MathConsensusSnapshot_no_update" BEFORE UPDATE OR DELETE ON "MathConsensusSnapshot" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "MathScoreSnapshot_no_update" BEFORE UPDATE OR DELETE ON "MathScoreSnapshot" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "MathRadarSnapshot_no_update" BEFORE UPDATE OR DELETE ON "MathRadarSnapshot" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();

-- Deliberately no GRANT to orvok_app_runtime. Internal calculation workers only.

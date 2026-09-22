-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "QuestionDomain" AS ENUM ('WORLD', 'RADAR');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('SELF_ANSWER', 'BE_PREDICTED');

-- CreateEnum
CREATE TYPE "VisibilityScope" AS ENUM ('PRIVATE', 'SHARED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "EvidenceDomain" AS ENUM ('WORLD', 'RADAR');

-- CreateEnum
CREATE TYPE "EvidenceState" AS ENUM ('INITIAL', 'EVALUATION', 'SUFFICIENT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "stableKey" VARCHAR(120) NOT NULL,
    "domain" "QuestionDomain" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionVersion" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "familyKey" VARCHAR(120) NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerOption" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentGrant" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "scope" "VisibilityScope" NOT NULL,
    "noticeVersion" VARCHAR(80) NOT NULL,
    "noticeHash" VARCHAR(64) NOT NULL,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRevocation" (
    "id" UUID NOT NULL,
    "grantId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "revokedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRevocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerVersion" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "consentGrantId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "supersedesId" UUID,
    "answeredAt" TIMESTAMPTZ(6) NOT NULL,
    "snapshotHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionEvent" (
    "id" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "resolutionSource" TEXT NOT NULL,
    "resolutionRule" TEXT NOT NULL,
    "opensAt" TIMESTAMPTZ(6) NOT NULL,
    "closesAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionSnapshot" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "predictorId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "probabilityVector" JSONB NOT NULL,
    "supersedesId" UUID,
    "predictedAt" TIMESTAMPTZ(6) NOT NULL,
    "snapshotHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPredictionSnapshot" (
    "id" UUID NOT NULL,
    "predictorId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "questionVersionId" UUID NOT NULL,
    "answerVersionId" UUID NOT NULL,
    "selfAnswerVersionId" UUID NOT NULL,
    "targetConsentGrantId" UUID NOT NULL,
    "probabilityVector" JSONB NOT NULL,
    "supersedesId" UUID,
    "predictedAt" TIMESTAMPTZ(6) NOT NULL,
    "snapshotHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPredictionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(120) NOT NULL,
    "objectType" VARCHAR(120) NOT NULL,
    "objectId" UUID NOT NULL,
    "contextHash" VARCHAR(64),
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceAssessment" (
    "id" UUID NOT NULL,
    "domain" "EvidenceDomain" NOT NULL,
    "subjectId" UUID NOT NULL,
    "evidenceState" "EvidenceState" NOT NULL,
    "methodVersion" VARCHAR(80) NOT NULL,
    "assessedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Question_stableKey_key" ON "Question"("stableKey");

-- CreateIndex
CREATE INDEX "QuestionVersion_familyKey_idx" ON "QuestionVersion"("familyKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionVersion_questionId_version_key" ON "QuestionVersion"("questionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerOption_questionVersionId_code_key" ON "AnswerOption"("questionVersionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerOption_questionVersionId_position_key" ON "AnswerOption"("questionVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerOption_id_questionVersionId_key" ON "AnswerOption"("id", "questionVersionId");

-- CreateIndex
CREATE INDEX "ConsentGrant_subjectId_purpose_grantedAt_idx" ON "ConsentGrant"("subjectId", "purpose", "grantedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentGrant_id_subjectId_key" ON "ConsentGrant"("id", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRevocation_grantId_key" ON "ConsentRevocation"("grantId");

-- CreateIndex
CREATE INDEX "ConsentRevocation_subjectId_revokedAt_idx" ON "ConsentRevocation"("subjectId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRevocation_grantId_subjectId_key" ON "ConsentRevocation"("grantId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerVersion_supersedesId_key" ON "AnswerVersion"("supersedesId");

-- CreateIndex
CREATE INDEX "AnswerVersion_subjectId_answeredAt_idx" ON "AnswerVersion"("subjectId", "answeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerVersion_subjectId_questionVersionId_version_key" ON "AnswerVersion"("subjectId", "questionVersionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerVersion_id_subjectId_questionVersionId_key" ON "AnswerVersion"("id", "subjectId", "questionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionEvent_id_questionVersionId_key" ON "PredictionEvent"("id", "questionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionSnapshot_supersedesId_key" ON "PredictionSnapshot"("supersedesId");

-- CreateIndex
CREATE INDEX "PredictionSnapshot_eventId_predictorId_predictedAt_idx" ON "PredictionSnapshot"("eventId", "predictorId", "predictedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPredictionSnapshot_supersedesId_key" ON "SocialPredictionSnapshot"("supersedesId");

-- CreateIndex
CREATE INDEX "SocialPredictionSnapshot_predictorId_targetId_predictedAt_idx" ON "SocialPredictionSnapshot"("predictorId", "targetId", "predictedAt");

-- CreateIndex
CREATE INDEX "AuditLog_objectType_objectId_occurredAt_idx" ON "AuditLog"("objectType", "objectId", "occurredAt");

-- CreateIndex
CREATE INDEX "EvidenceAssessment_domain_subjectId_assessedAt_idx" ON "EvidenceAssessment"("domain", "subjectId", "assessedAt");

-- AddForeignKey
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerOption" ADD CONSTRAINT "AnswerOption_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentGrant" ADD CONSTRAINT "ConsentGrant_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRevocation" ADD CONSTRAINT "ConsentRevocation_grantId_subjectId_fkey" FOREIGN KEY ("grantId", "subjectId") REFERENCES "ConsentGrant"("id", "subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRevocation" ADD CONSTRAINT "ConsentRevocation_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerVersion" ADD CONSTRAINT "AnswerVersion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerVersion" ADD CONSTRAINT "AnswerVersion_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerVersion" ADD CONSTRAINT "AnswerVersion_optionId_questionVersionId_fkey" FOREIGN KEY ("optionId", "questionVersionId") REFERENCES "AnswerOption"("id", "questionVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerVersion" ADD CONSTRAINT "AnswerVersion_consentGrantId_subjectId_fkey" FOREIGN KEY ("consentGrantId", "subjectId") REFERENCES "ConsentGrant"("id", "subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerVersion" ADD CONSTRAINT "AnswerVersion_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "AnswerVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionEvent" ADD CONSTRAINT "PredictionEvent_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionSnapshot" ADD CONSTRAINT "PredictionSnapshot_eventId_questionVersionId_fkey" FOREIGN KEY ("eventId", "questionVersionId") REFERENCES "PredictionEvent"("id", "questionVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionSnapshot" ADD CONSTRAINT "PredictionSnapshot_predictorId_fkey" FOREIGN KEY ("predictorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionSnapshot" ADD CONSTRAINT "PredictionSnapshot_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionSnapshot" ADD CONSTRAINT "PredictionSnapshot_optionId_questionVersionId_fkey" FOREIGN KEY ("optionId", "questionVersionId") REFERENCES "AnswerOption"("id", "questionVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionSnapshot" ADD CONSTRAINT "PredictionSnapshot_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "PredictionSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPredictionSnapshot" ADD CONSTRAINT "SocialPredictionSnapshot_predictorId_fkey" FOREIGN KEY ("predictorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPredictionSnapshot" ADD CONSTRAINT "SocialPredictionSnapshot_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPredictionSnapshot" ADD CONSTRAINT "SocialPredictionSnapshot_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPredictionSnapshot" ADD CONSTRAINT "SocialPredictionSnapshot_answerVersionId_targetId_question_fkey" FOREIGN KEY ("answerVersionId", "targetId", "questionVersionId") REFERENCES "AnswerVersion"("id", "subjectId", "questionVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPredictionSnapshot" ADD CONSTRAINT "SocialPredictionSnapshot_selfAnswerVersionId_predictorId_q_fkey" FOREIGN KEY ("selfAnswerVersionId", "predictorId", "questionVersionId") REFERENCES "AnswerVersion"("id", "subjectId", "questionVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPredictionSnapshot" ADD CONSTRAINT "SocialPredictionSnapshot_targetConsentGrantId_targetId_fkey" FOREIGN KEY ("targetConsentGrantId", "targetId") REFERENCES "ConsentGrant"("id", "subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPredictionSnapshot" ADD CONSTRAINT "SocialPredictionSnapshot_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "SocialPredictionSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Structural invariants independent of future scoring and consent policy.
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_positive_version" CHECK ("version" > 0);
ALTER TABLE "AnswerOption" ADD CONSTRAINT "AnswerOption_nonnegative_position" CHECK ("position" >= 0);
ALTER TABLE "AnswerVersion" ADD CONSTRAINT "AnswerVersion_positive_version" CHECK ("version" > 0);
ALTER TABLE "PredictionEvent" ADD CONSTRAINT "PredictionEvent_valid_window" CHECK ("opensAt" < "closesAt");
ALTER TABLE "PredictionSnapshot" ADD CONSTRAINT "PredictionSnapshot_vector_array" CHECK (jsonb_typeof("probabilityVector") = 'array');
ALTER TABLE "SocialPredictionSnapshot" ADD CONSTRAINT "SocialPredictionSnapshot_vector_array" CHECK (jsonb_typeof("probabilityVector") = 'array');
ALTER TABLE "SocialPredictionSnapshot" ADD CONSTRAINT "SocialPredictionSnapshot_distinct_people" CHECK ("predictorId" <> "targetId");

-- Corrections append new versions. Deletion policy remains provisional pending legal review.
CREATE FUNCTION "forbid_structural_history_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'historical ORVOK records are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "QuestionVersion_no_update" BEFORE UPDATE ON "QuestionVersion" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "AnswerOption_no_update" BEFORE UPDATE ON "AnswerOption" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "ConsentGrant_no_update" BEFORE UPDATE ON "ConsentGrant" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "ConsentRevocation_no_update" BEFORE UPDATE ON "ConsentRevocation" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "AnswerVersion_no_update" BEFORE UPDATE ON "AnswerVersion" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "PredictionSnapshot_no_update" BEFORE UPDATE ON "PredictionSnapshot" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "SocialPredictionSnapshot_no_update" BEFORE UPDATE ON "SocialPredictionSnapshot" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "AuditLog_no_update" BEFORE UPDATE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "EvidenceAssessment_no_update" BEFORE UPDATE ON "EvidenceAssessment" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();

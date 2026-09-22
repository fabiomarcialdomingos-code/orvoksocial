CREATE TYPE "ConsentNoticeStatus" AS ENUM ('DRAFT', 'APPROVED');
CREATE TYPE "DataRequestType" AS ENUM ('ACCESS', 'EXPORT', 'ERASURE');
CREATE TYPE "DataRequestStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'READY', 'REVIEW_REQUIRED', 'CLOSED');
CREATE TYPE "NotificationState" AS ENUM ('UNREAD', 'READ', 'DISMISSED');
CREATE TYPE "ApiIdempotencyState" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "ConsentNotice" (
  id UUID PRIMARY KEY,
  purpose "ConsentPurpose" NOT NULL,
  version VARCHAR(80) NOT NULL,
  content TEXT NOT NULL,
  "contentHash" VARCHAR(64) NOT NULL,
  status "ConsentNoticeStatus" NOT NULL DEFAULT 'DRAFT',
  "approvedAt" TIMESTAMPTZ(6),
  "approvedById" UUID REFERENCES "User"(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentNotice_purpose_version_key" UNIQUE (purpose,version),
  CONSTRAINT "ConsentNotice_purpose_version_hash_key" UNIQUE (purpose,version,"contentHash"),
  CONSTRAINT "ConsentNotice_approval_complete" CHECK ((status='APPROVED' AND "approvedAt" IS NOT NULL AND "approvedById" IS NOT NULL) OR (status='DRAFT' AND "approvedAt" IS NULL AND "approvedById" IS NULL)),
  CONSTRAINT "ConsentNotice_hash_shape" CHECK ("contentHash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "DataRequest" (
  id UUID PRIMARY KEY,
  "subjectId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  type "DataRequestType" NOT NULL,
  status "DataRequestStatus" NOT NULL DEFAULT 'RECEIVED',
  "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DataRequest_subjectId_requestedAt_idx" ON "DataRequest"("subjectId","requestedAt");

CREATE TABLE "Notification" (
  id UUID PRIMARY KEY,
  "recipientId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "eventType" VARCHAR(80) NOT NULL,
  "sourceId" UUID NOT NULL,
  "sourceVersion" INTEGER NOT NULL,
  state "NotificationState" NOT NULL DEFAULT 'UNREAD',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMPTZ(6),
  "dismissedAt" TIMESTAMPTZ(6),
  CONSTRAINT "Notification_source_version_positive" CHECK ("sourceVersion" > 0),
  CONSTRAINT "Notification_unique_source" UNIQUE ("recipientId","eventType","sourceId","sourceVersion")
);
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId","createdAt");

CREATE TABLE "ApiIdempotency" (
  id UUID PRIMARY KEY,
  "actorId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  route VARCHAR(160) NOT NULL,
  key VARCHAR(128) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  state "ApiIdempotencyState" NOT NULL DEFAULT 'PENDING',
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiIdempotency_actor_route_key" UNIQUE ("actorId",route,key),
  CONSTRAINT "ApiIdempotency_completed_shape" CHECK ((state='PENDING' AND "responseStatus" IS NULL AND "responseBody" IS NULL) OR (state='COMPLETED' AND "responseStatus" BETWEEN 200 AND 299 AND "responseBody" IS NOT NULL))
);

-- Existing historical grants retain their recorded notice fields. New grants must
-- reference a separately approved notice; NOT VALID avoids rewriting history.
ALTER TABLE "ConsentGrant" ADD CONSTRAINT "ConsentGrant_notice_registry_fkey"
  FOREIGN KEY (purpose,"noticeVersion","noticeHash")
  REFERENCES "ConsentNotice"(purpose,version,"contentHash") ON DELETE RESTRICT NOT VALID;

CREATE FUNCTION "consent_notice_guard"() RETURNS trigger AS $$
DECLARE approver_role "UserRole";
BEGIN
  IF TG_OP='UPDATE' AND OLD.status='APPROVED' THEN
    RAISE EXCEPTION 'approved notice is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status='APPROVED' THEN
    SELECT role INTO approver_role FROM "User" WHERE id=NEW."approvedById" AND status='ACTIVE';
    IF approver_role IS DISTINCT FROM 'ADMIN' THEN
      RAISE EXCEPTION 'notice approval requires active admin' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ConsentNotice_guard" BEFORE INSERT OR UPDATE ON "ConsentNotice" FOR EACH ROW EXECUTE FUNCTION "consent_notice_guard"();

CREATE FUNCTION "consent_approved_guard"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ConsentNotice" n WHERE n.purpose=NEW.purpose AND n.version=NEW."noticeVersion" AND n."contentHash"=NEW."noticeHash" AND n.status='APPROVED') THEN
    RAISE EXCEPTION 'approved consent notice required' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ConsentGrant_approved_notice_guard" BEFORE INSERT ON "ConsentGrant" FOR EACH ROW EXECUTE FUNCTION "consent_approved_guard"();

CREATE FUNCTION "answer_consent_guard"() RETURNS trigger AS $$
DECLARE grant_row "ConsentGrant";
BEGIN
  SELECT * INTO grant_row FROM "ConsentGrant" WHERE id=NEW."consentGrantId" AND "subjectId"=NEW."subjectId" FOR UPDATE;
  IF NOT FOUND OR grant_row.purpose <> 'SELF_ANSWER' OR grant_row."grantedAt" >= NEW."answeredAt" OR NEW."answeredAt" > clock_timestamp() OR
     EXISTS (SELECT 1 FROM "ConsentRevocation" r WHERE r."grantId"=grant_row.id) THEN
    RAISE EXCEPTION 'active self-answer consent required before answer' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AnswerVersion_consent_guard" BEFORE INSERT ON "AnswerVersion" FOR EACH ROW EXECUTE FUNCTION "answer_consent_guard"();

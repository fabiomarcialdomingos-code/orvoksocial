CREATE TABLE "MathDomainEvent" (
  id uuid PRIMARY KEY,
  "eventType" varchar(100) NOT NULL,
  "aggregateType" varchar(80) NOT NULL,
  "aggregateId" uuid NOT NULL,
  sequence bigint NOT NULL,
  payload jsonb NOT NULL,
  "idempotencyKey" varchar(180) NOT NULL UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DISPATCHED','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  "occurredAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  "dispatchedAt" timestamptz(6)
);
CREATE UNIQUE INDEX "MathDomainEvent_aggregate_sequence_idx" ON "MathDomainEvent" ("aggregateType","aggregateId",sequence);
CREATE INDEX "MathDomainEvent_pending_idx" ON "MathDomainEvent" (status,"occurredAt");
ALTER TABLE "MathProcessingJob" ADD COLUMN "domainEventId" uuid REFERENCES "MathDomainEvent"(id) ON DELETE RESTRICT;
CREATE INDEX "MathProcessingJob_domainEvent_idx" ON "MathProcessingJob" ("domainEventId");

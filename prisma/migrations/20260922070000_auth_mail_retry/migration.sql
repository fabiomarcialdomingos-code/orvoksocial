ALTER TABLE "AuthMailOutbox" ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AuthMailOutbox" ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AuthMailOutbox" ADD CONSTRAINT "AuthMailOutbox_attempts_nonnegative" CHECK (attempts >= 0);
DROP INDEX "AuthMailOutbox_pending_idx";
CREATE INDEX "AuthMailOutbox_pending_idx" ON "AuthMailOutbox"("nextAttemptAt") WHERE "deliveredAt" IS NULL;

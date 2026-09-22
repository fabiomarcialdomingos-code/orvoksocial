CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');
CREATE TYPE "AuthTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

CREATE TABLE "AuthIdentity" (
  "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE RESTRICT,
  "email" VARCHAR(320) NOT NULL UNIQUE,
  "passwordHash" VARCHAR(255) NOT NULL,
  "verifiedAt" TIMESTAMPTZ(6),
  "passwordChangedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthIdentity_email_canonical" CHECK ("email" = lower(trim("email")) AND length("email") BETWEEN 3 AND 320)
);

CREATE TABLE "AuthSession" (
  id UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "tokenHash" VARCHAR(64) NOT NULL UNIQUE,
  "familyId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "revokedAt" TIMESTAMPTZ(6),
  "replacedById" UUID UNIQUE,
  CONSTRAINT "AuthSession_time" CHECK ("expiresAt" > "createdAt" AND ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")),
  CONSTRAINT "AuthSession_replacement_fkey" FOREIGN KEY ("replacedById") REFERENCES "AuthSession"(id) ON DELETE RESTRICT
);
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");
CREATE INDEX "AuthSession_familyId_idx" ON "AuthSession"("familyId");

CREATE TABLE "AuthToken" (
  id UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  purpose "AuthTokenPurpose" NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "consumedAt" TIMESTAMPTZ(6),
  CONSTRAINT "AuthToken_time" CHECK ("expiresAt" > "createdAt" AND ("consumedAt" IS NULL OR "consumedAt" >= "createdAt"))
);
CREATE INDEX "AuthToken_userId_purpose_expiresAt_idx" ON "AuthToken"("userId",purpose,"expiresAt");

CREATE TABLE "AuthRateLimit" (
  "keyHash" VARCHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  "resetsAt" TIMESTAMPTZ(6) NOT NULL
);

CREATE TABLE "AuthMailOutbox" (
  id UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  purpose "AuthTokenPurpose" NOT NULL,
  "encryptedPayload" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMPTZ(6),
  "failedAt" TIMESTAMPTZ(6)
);
CREATE INDEX "AuthMailOutbox_pending_idx" ON "AuthMailOutbox"("createdAt") WHERE "deliveredAt" IS NULL;

CREATE FUNCTION "auth_identity_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."verifiedAt" IS NOT NULL AND NEW."verifiedAt" IS NULL THEN
    RAISE EXCEPTION 'email verification cannot be removed' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AuthIdentity_guard" BEFORE UPDATE ON "AuthIdentity" FOR EACH ROW EXECUTE FUNCTION "auth_identity_guard"();

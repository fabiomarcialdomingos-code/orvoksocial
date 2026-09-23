ALTER TABLE "AuthIdentity" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE "AuthProviderIdentity" (
  id uuid PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  provider varchar(40) NOT NULL,
  subject varchar(255) NOT NULL,
  email varchar(320) NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  "lastLoginAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (provider, subject),
  UNIQUE (provider, email)
);
CREATE INDEX "AuthProviderIdentity_userId_idx" ON "AuthProviderIdentity" ("userId");

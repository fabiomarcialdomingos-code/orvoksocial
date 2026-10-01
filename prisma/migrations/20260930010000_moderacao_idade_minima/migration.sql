-- Idade mínima (16 anos), denúncia e bloqueio pessoal entre quem cria e quem
-- responde um desafio. Nenhuma dessas tabelas tem política de linha (RLS): o
-- controle de acesso é feito inteiramente pelo serviço da aplicação
-- (src/lib/desafio/service.ts), como já ocorre com GuestChallenge.

ALTER TABLE "GuestChallengeAttempt" ADD COLUMN "ageConsentVersion" varchar(40);

CREATE TABLE "GuestReport" (
  id uuid PRIMARY KEY,
  "challengeId" uuid NOT NULL REFERENCES "GuestChallenge"(id) ON DELETE CASCADE,
  "reporterTokenHash" varchar(64) NOT NULL,
  "reporterUserId" uuid REFERENCES "User"(id) ON DELETE SET NULL,
  reason varchar(1000) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "GuestReport_challenge_idx" ON "GuestReport"("challengeId");

CREATE TABLE "GuestBlock" (
  id uuid PRIMARY KEY,
  "blockerTokenHash" varchar(64) NOT NULL,
  "blockerUserId" uuid REFERENCES "User"(id) ON DELETE SET NULL,
  "blockedOwnerTokenHash" varchar(64),
  "blockedOwnerUserId" uuid REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT guest_block_has_target CHECK ("blockedOwnerTokenHash" IS NOT NULL OR "blockedOwnerUserId" IS NOT NULL)
);
CREATE INDEX "GuestBlock_blocker_token_idx" ON "GuestBlock"("blockerTokenHash");
CREATE INDEX "GuestBlock_blocker_user_idx" ON "GuestBlock"("blockerUserId");
CREATE INDEX "GuestBlock_blocked_token_idx" ON "GuestBlock"("blockedOwnerTokenHash");
CREATE INDEX "GuestBlock_blocked_user_idx" ON "GuestBlock"("blockedOwnerUserId");
-- Evita bloqueios duplicados vindos de cliques repetidos (índices parciais,
-- pois cada lado do bloqueado pode ser nulo).
CREATE UNIQUE INDEX "GuestBlock_por_token_unico" ON "GuestBlock"("blockerTokenHash", "blockedOwnerTokenHash") WHERE "blockedOwnerTokenHash" IS NOT NULL;
CREATE UNIQUE INDEX "GuestBlock_por_conta_unico" ON "GuestBlock"("blockerTokenHash", "blockedOwnerUserId") WHERE "blockedOwnerUserId" IS NOT NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON "GuestReport","GuestBlock" TO orvok_auth_runtime;
  END IF;
END $$;

-- Desafio sem cadastro.
-- Quem chega pelo anúncio responde sobre si e convida alguém antes de ter conta.
-- Os dados ficam em tabelas próprias, fora do Radar formal, e são vinculados à
-- conta quando a pessoa se cadastra (reivindicação pelo token do aparelho).
-- Dados mínimos: primeiro nome, códigos das opções escolhidas e o registro do
-- consentimento para ser previsto (versão e hash do aviso exibido).

CREATE TABLE "GuestChallenge" (
  "id"                   uuid PRIMARY KEY,
  "code"                 varchar(12) NOT NULL UNIQUE,
  "creatorName"          varchar(24) NOT NULL,
  "catalogVersion"       varchar(80) NOT NULL,
  "answers"              jsonb NOT NULL,
  "consentNoticeVersion" varchar(80) NOT NULL,
  "consentNoticeHash"    varchar(64) NOT NULL,
  "consentedAt"          timestamptz(6) NOT NULL,
  "ownerTokenHash"       varchar(64) NOT NULL,
  "claimedByUserId"      uuid REFERENCES "User"("id") ON DELETE SET NULL,
  "claimedAt"            timestamptz(6),
  "revokedAt"            timestamptz(6),
  "expiresAt"            timestamptz(6) NOT NULL,
  "createdAt"            timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT guest_challenge_name_len CHECK (char_length(btrim("creatorName")) BETWEEN 2 AND 24),
  CONSTRAINT guest_challenge_answers_array CHECK (jsonb_typeof("answers") = 'array')
);
CREATE INDEX "GuestChallenge_owner_idx" ON "GuestChallenge" ("ownerTokenHash");
CREATE INDEX "GuestChallenge_claimed_idx" ON "GuestChallenge" ("claimedByUserId");

CREATE TABLE "GuestChallengeAttempt" (
  "id"              uuid PRIMARY KEY,
  "challengeId"     uuid NOT NULL REFERENCES "GuestChallenge"("id") ON DELETE CASCADE,
  "predictorName"   varchar(24),
  "predictions"     jsonb NOT NULL,
  "score"           smallint NOT NULL,
  "total"           smallint NOT NULL,
  "ownerTokenHash"  varchar(64) NOT NULL,
  "claimedByUserId" uuid REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt"       timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT guest_attempt_score CHECK ("score" BETWEEN 0 AND "total"),
  CONSTRAINT guest_attempt_predictions_array CHECK (jsonb_typeof("predictions") = 'array'),
  CONSTRAINT guest_attempt_one_per_device UNIQUE ("challengeId","ownerTokenHash")
);
CREATE INDEX "GuestChallengeAttempt_challenge_idx" ON "GuestChallengeAttempt" ("challengeId","createdAt");
CREATE INDEX "GuestChallengeAttempt_owner_idx" ON "GuestChallengeAttempt" ("ownerTokenHash");

-- As rotas do desafio rodam sem sessão, pelo papel de autenticação.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON "GuestChallenge","GuestChallengeAttempt" TO orvok_auth_runtime;
  END IF;
END $$;

-- Mundo entre pessoas: o evento é só o assunto. Uma pessoa responde em
-- segredo e a outra tenta adivinhar; tudo é revelado depois do evento.
--   mode 'ser_previsto': quem criou responde; o convidado adivinha.
--   mode 'prever':       o convidado responde; quem criou adivinha.
CREATE TABLE "WorldRound" (
  id uuid PRIMARY KEY,
  code varchar(8) NOT NULL UNIQUE,
  "eventId" uuid NOT NULL REFERENCES "WorldEvent"(id) ON DELETE CASCADE,
  mode varchar(12) NOT NULL CHECK (mode IN ('ser_previsto','prever')),
  "initiatorUserId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "initiatorName" varchar(24) NOT NULL,
  "guestName" varchar(24),
  "guestTokenHash" varchar(64),
  "guestUserId" uuid REFERENCES "User"(id) ON DELETE SET NULL,
  "answerOpportunityId" uuid REFERENCES "WorldOpportunity"(id),
  "guessOpportunityId" uuid REFERENCES "WorldOpportunity"(id),
  "guessUnsure" boolean NOT NULL DEFAULT false,
  "ageConsentVersion" varchar(40),
  "answeredAt" timestamptz,
  "guessedAt" timestamptz,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "WorldRound_initiator_idx" ON "WorldRound"("initiatorUserId","createdAt");
CREATE INDEX "WorldRound_guest_idx" ON "WorldRound"("guestTokenHash");
-- Mesma dupla, mesmo evento, mesma direção: uma rodada só (evento + remetente + destinatário).
CREATE UNIQUE INDEX "WorldRound_dupla_unica" ON "WorldRound"("eventId","initiatorUserId","mode","guestTokenHash") WHERE "guestTokenHash" IS NOT NULL AND "revokedAt" IS NULL;

-- Medição do caminho do usuário: só nome do passo, código e um hash do aparelho.
CREATE TABLE "ProductEvent" (
  id bigserial PRIMARY KEY,
  name varchar(40) NOT NULL,
  code varchar(8),
  "actorHash" varchar(64),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "ProductEvent_name_idx" ON "ProductEvent"(name,"createdAt");

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON "WorldRound" TO orvok_auth_runtime;
    GRANT SELECT,INSERT ON "ProductEvent" TO orvok_auth_runtime;
    GRANT USAGE,SELECT ON SEQUENCE "ProductEvent_id_seq" TO orvok_auth_runtime;
    GRANT SELECT ON "WorldEvent","WorldOpportunity","WorldResolution" TO orvok_auth_runtime;
    DROP POLICY IF EXISTS world_event_read_auth ON "WorldEvent";
    CREATE POLICY world_event_read_auth ON "WorldEvent" FOR SELECT TO orvok_auth_runtime USING (status IN ('PUBLISHED','CLOSED','RESOLVED','CANCELLED','VOID'));
    DROP POLICY IF EXISTS world_opportunity_read_auth ON "WorldOpportunity";
    CREATE POLICY world_opportunity_read_auth ON "WorldOpportunity" FOR SELECT TO orvok_auth_runtime USING (true);
    DROP POLICY IF EXISTS world_resolution_read_auth ON "WorldResolution";
    CREATE POLICY world_resolution_read_auth ON "WorldResolution" FOR SELECT TO orvok_auth_runtime USING (true);
  END IF;
END $$;

-- Categorias também são lidas pelo serviço do Mundo entre pessoas.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT ON "WorldCategory" TO orvok_auth_runtime;
    DROP POLICY IF EXISTS world_category_read_auth ON "WorldCategory";
    CREATE POLICY world_category_read_auth ON "WorldCategory" FOR SELECT TO orvok_auth_runtime USING (true);
  END IF;
END $$;

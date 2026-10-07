-- Card do convite (a imagem de prévia que aparece no WhatsApp), desenhado uma vez e guardado pronto para ser entregue na hora.
-- Desenhar o PNG na hora levava 2 a 4 segundos e o WhatsApp não esperava. Some junto com o convite (cascata).
CREATE TABLE "GuestChallengeCard" (
  "challengeId" uuid PRIMARY KEY REFERENCES "GuestChallenge"(id) ON DELETE CASCADE,
  version varchar(80) NOT NULL,
  png bytea NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON "GuestChallengeCard" TO orvok_auth_runtime;
  END IF;
END $$;

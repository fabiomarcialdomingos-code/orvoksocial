-- Quem tem conta e quer conversar confirma uma vez (16+ e Termos) antes da
-- primeira conversa. Quem entrou como convidado já confirma isso ao dar a
-- opinião; já quem criou a conversa vinha de um cadastro que não pedia isso.
CREATE TABLE "UserAgeConsent" (
  "userId" uuid PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  version varchar(40) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT ON "UserAgeConsent" TO orvok_auth_runtime;
  END IF;
END $$;

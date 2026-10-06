-- Denúncias de lembranças da Estante (texto ou foto). Quem recebe a lembrança pode denunciar; ela some
-- da estante de quem denunciou na hora, e a equipe revisa por e-mail (sem o conteúdo no e-mail).
CREATE TABLE "ShelfReport" (
  id uuid PRIMARY KEY,
  "keepsakeId" uuid NOT NULL REFERENCES "Keepsake"(id) ON DELETE CASCADE,
  "reporterId" uuid NOT NULL REFERENCES "ShelfPerson"(id) ON DELETE CASCADE,
  reason varchar(500) NOT NULL,
  state varchar(10) NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN','RESOLVED')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "ShelfReport_unica" UNIQUE ("keepsakeId","reporterId")
);
CREATE INDEX "ShelfReport_state" ON "ShelfReport" (state,"createdAt");

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT ON "ShelfReport" TO orvok_auth_runtime;
  END IF;
END $$;

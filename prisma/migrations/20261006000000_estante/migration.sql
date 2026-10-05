-- A Estante: lembranças ("lembrei de você") entre pessoas que se conhecem.
-- Quem manda diz o quanto acha que a outra pessoa vai gostar; quem recebe reage; a comparação é a recompensa.
-- Tudo isso fica atrás do interruptor AppFlag 'estante' (desligado) até o lançamento.

CREATE TABLE "AppFlag" (
  name varchar(40) PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO "AppFlag" (name, enabled) VALUES ('estante', false) ON CONFLICT (name) DO NOTHING;

-- Quem participa: uma conta, ou só este aparelho (convidado, sem cadastro). Os dois podem coexistir depois de "reivindicar".
CREATE TABLE "ShelfPerson" (
  id uuid PRIMARY KEY,
  "userId" uuid UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  "tokenHash" varchar(64) UNIQUE,
  name varchar(24) NOT NULL,
  "inviteCode" varchar(10) NOT NULL UNIQUE,
  "ageConsentVersion" varchar(40),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT shelf_person_tem_identidade CHECK ("userId" IS NOT NULL OR "tokenHash" IS NOT NULL)
);

-- Duas pessoas que se conhecem (o círculo). Sempre guardado com "personA" < "personB".
CREATE TABLE "ShelfBond" (
  id uuid PRIMARY KEY,
  "personA" uuid NOT NULL REFERENCES "ShelfPerson"(id) ON DELETE CASCADE,
  "personB" uuid NOT NULL REFERENCES "ShelfPerson"(id) ON DELETE CASCADE,
  status varchar(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','BLOCKED')),
  "blockedBy" uuid REFERENCES "ShelfPerson"(id) ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT shelf_bond_ordem CHECK ("personA" < "personB")
);
CREATE UNIQUE INDEX "ShelfBond_par" ON "ShelfBond" ("personA","personB");
CREATE INDEX "ShelfBond_b" ON "ShelfBond" ("personB");

-- A lembrança: um objeto, uma frase, a previsão de quem mandou e a reação de quem recebeu.
CREATE TABLE "Keepsake" (
  id uuid PRIMARY KEY,
  code varchar(10) NOT NULL UNIQUE,
  "fromId" uuid NOT NULL REFERENCES "ShelfPerson"(id) ON DELETE CASCADE,
  "toId" uuid REFERENCES "ShelfPerson"(id) ON DELETE CASCADE,
  "toName" varchar(24),
  title varchar(60) NOT NULL,
  note varchar(240),
  "imageId" uuid,
  "illustrationSvg" text,
  predicted smallint NOT NULL CHECK (predicted BETWEEN 1 AND 5),
  reaction smallint CHECK (reaction BETWEEN 1 AND 5),
  "reactedAt" timestamptz,
  state varchar(10) NOT NULL DEFAULT 'VISIBLE' CHECK (state IN ('PENDING','VISIBLE','HIDDEN','REMOVED')),
  "openedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT keepsake_reacao_so_com_dono CHECK (reaction IS NULL OR "toId" IS NOT NULL)
);
CREATE INDEX "Keepsake_to" ON "Keepsake" ("toId","createdAt" DESC);
CREATE INDEX "Keepsake_from" ON "Keepsake" ("fromId","createdAt" DESC);

-- Quem passou pela estante de quem, no dia. "mark" é o "passei por aqui" que a pessoa escolheu deixar.
CREATE TABLE "ShelfVisit" (
  id uuid PRIMARY KEY,
  "ownerId" uuid NOT NULL REFERENCES "ShelfPerson"(id) ON DELETE CASCADE,
  "visitorId" uuid NOT NULL REFERENCES "ShelfPerson"(id) ON DELETE CASCADE,
  day date NOT NULL,
  mark boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "ShelfVisit_unico" UNIQUE ("ownerId","visitorId",day)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON "AppFlag" TO orvok_auth_runtime;
    GRANT SELECT,INSERT,UPDATE,DELETE ON "ShelfPerson" TO orvok_auth_runtime;
    GRANT SELECT,INSERT,UPDATE,DELETE ON "ShelfBond" TO orvok_auth_runtime;
    GRANT SELECT,INSERT,UPDATE,DELETE ON "Keepsake" TO orvok_auth_runtime;
    GRANT SELECT,INSERT,UPDATE,DELETE ON "ShelfVisit" TO orvok_auth_runtime;
  END IF;
END $$;

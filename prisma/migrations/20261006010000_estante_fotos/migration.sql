-- Fotos da Estante: fotinha de perfil e foto dentro de uma lembrança.
-- Guardadas no próprio banco, já reduzidas e sem dados de localização (webp), e só servidas a quem pode ver.
CREATE TABLE "ShelfImage" (
  id uuid PRIMARY KEY,
  "ownerId" uuid NOT NULL REFERENCES "ShelfPerson"(id) ON DELETE CASCADE,
  purpose varchar(10) NOT NULL CHECK (purpose IN ('avatar','keepsake')),
  mime varchar(20) NOT NULL DEFAULT 'image/webp',
  bytes bytea NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  "byteSize" integer NOT NULL,
  sha256 varchar(64) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "ShelfImage_owner" ON "ShelfImage" ("ownerId","createdAt" DESC);

ALTER TABLE "ShelfPerson" ADD COLUMN "avatarImageId" uuid REFERENCES "ShelfImage"(id) ON DELETE SET NULL;
ALTER TABLE "Keepsake" ADD CONSTRAINT "Keepsake_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ShelfImage"(id) ON DELETE SET NULL;

-- Registro das decisões da moderação (sem guardar a imagem recusada), para barrar quem insiste.
CREATE TABLE "ShelfModerationLog" (
  id bigserial PRIMARY KEY,
  "personId" uuid NOT NULL REFERENCES "ShelfPerson"(id) ON DELETE CASCADE,
  kind varchar(8) NOT NULL CHECK (kind IN ('imagem','texto')),
  ok boolean NOT NULL,
  reason varchar(40) NOT NULL,
  sha256 varchar(64),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "ShelfModerationLog_person" ON "ShelfModerationLog" ("personId","createdAt" DESC);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON "ShelfImage" TO orvok_auth_runtime;
    GRANT SELECT,INSERT ON "ShelfModerationLog" TO orvok_auth_runtime;
    GRANT USAGE ON SEQUENCE "ShelfModerationLog_id_seq" TO orvok_auth_runtime;
  END IF;
END $$;

-- Ilustrações dos objetos da Estante. O mesmo objeto ("Violão") reaproveita o mesmo desenho para todo
-- mundo: mais barato e com estilo consistente. A chave é só o resumo (hash) do nome já normalizado,
-- então a tabela não guarda o texto que as pessoas escreveram.
CREATE TABLE "ShelfIllustration" (
  "key" varchar(64) PRIMARY KEY,
  svg text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "ShelfIllustration_created" ON "ShelfIllustration" ("createdAt");

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT ON "ShelfIllustration" TO orvok_auth_runtime;
  END IF;
END $$;

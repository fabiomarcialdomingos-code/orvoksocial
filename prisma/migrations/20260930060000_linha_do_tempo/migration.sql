-- Linha do tempo do retrato: guarda um registro sempre que o selo muda (ou
-- o "como te veem" se firma pela primeira vez), para a pessoa poder ver a
-- própria evolução. Não é um retrato novo a cada vez — é só um marco salvo
-- quando algo realmente mudou, para não virar um gráfico poluído de ruído.
CREATE TABLE "RetratoSnapshot" (
  id uuid PRIMARY KEY,
  "ownerTokenHash" varchar(64),
  "claimedByUserId" uuid REFERENCES "User"(id) ON DELETE CASCADE,
  respondentes int NOT NULL,
  batem int NOT NULL,
  nivel varchar(10),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT retrato_snapshot_tem_dono CHECK ("ownerTokenHash" IS NOT NULL OR "claimedByUserId" IS NOT NULL)
);
CREATE INDEX "RetratoSnapshot_token_idx" ON "RetratoSnapshot"("ownerTokenHash","createdAt");
CREATE INDEX "RetratoSnapshot_conta_idx" ON "RetratoSnapshot"("claimedByUserId","createdAt");

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON "RetratoSnapshot" TO orvok_auth_runtime;
  END IF;
END $$;

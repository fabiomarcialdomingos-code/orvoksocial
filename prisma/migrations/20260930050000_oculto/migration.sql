-- "Oculto": o quarto quadrante da Janela de Johari (o que a pessoa sabe de
-- si e escolhe não mostrar). Guarda só QUAL traço foi marcado, nunca um
-- texto livre — ninguém mais vê isso, nem entra na comparação "como te
-- veem" nem no selo. Serve só para a própria pessoa acompanhar, com o
-- tempo, se algo que ela guarda começa a aparecer naturalmente para quem a
-- cerca (quando o traço marcado passa a bater com a média de quem responde).
CREATE TABLE "HiddenTrait" (
  id uuid PRIMARY KEY,
  "ownerTokenHash" varchar(64),
  "claimedByUserId" uuid REFERENCES "User"(id) ON DELETE CASCADE,
  traco varchar(10) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT hidden_trait_tem_dono CHECK ("ownerTokenHash" IS NOT NULL OR "claimedByUserId" IS NOT NULL)
);
CREATE UNIQUE INDEX "HiddenTrait_token_traco_unico" ON "HiddenTrait"("ownerTokenHash", traco) WHERE "ownerTokenHash" IS NOT NULL;
CREATE UNIQUE INDEX "HiddenTrait_conta_traco_unico" ON "HiddenTrait"("claimedByUserId", traco) WHERE "claimedByUserId" IS NOT NULL;
CREATE INDEX "HiddenTrait_conta_idx" ON "HiddenTrait"("claimedByUserId");

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT,DELETE,UPDATE ON "HiddenTrait" TO orvok_auth_runtime;
  END IF;
END $$;

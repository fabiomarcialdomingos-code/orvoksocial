-- Avisos push: para o selo do app atualizar e a pessoa ser avisada mesmo
-- com o orvok fechado. Só para quem está logado e aceitou explicitamente
-- (nunca pedido sem um gesto claro da pessoa). Guarda só o necessário para
-- mandar o aviso — nenhum dado do aparelho além disso.
CREATE TABLE "PushSubscription" (
  id uuid PRIMARY KEY,
  "userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh varchar(255) NOT NULL,
  auth varchar(255) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "PushSubscription_user_idx" ON "PushSubscription"("userId");

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT,DELETE ON "PushSubscription" TO orvok_auth_runtime;
    -- O Mundo entre pessoas roda sob orvok_auth_runtime e também precisa
    -- poder avisar (ex.: "é sua vez de prever"), pelo mesmo mecanismo seguro
    -- já usado pelo resto do app.
    GRANT EXECUTE ON FUNCTION orvok_social_notify(uuid,text,uuid) TO orvok_auth_runtime;
  END IF;
END $$;

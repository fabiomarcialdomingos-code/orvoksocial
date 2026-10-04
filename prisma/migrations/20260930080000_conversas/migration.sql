-- Conversas depois da revelação no Mundo: só entre as duas pessoas de uma
-- conversa do Mundo já revelada, nunca com quem respondeu de forma anônima
-- sobre um retrato. Quem recebe o primeiro contato precisa aceitar. Uma
-- conversa por rodada. As mensagens são apagadas depois de 90 dias (job diário
-- em scripts/avisar-eventos.sql) e só são lidas pela moderação se alguém
-- denunciar.
CREATE TABLE "RoundThread" (
  id uuid PRIMARY KEY,
  "roundId" uuid NOT NULL UNIQUE REFERENCES "WorldRound"(id) ON DELETE CASCADE,
  "proposerSide" varchar(10) NOT NULL CHECK ("proposerSide" IN ('criador','convidado')),
  status varchar(10) NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED','ACCEPTED','DECLINED','CLOSED')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "respondedAt" timestamptz
);

CREATE TABLE "RoundMessage" (
  id uuid PRIMARY KEY,
  "threadId" uuid NOT NULL REFERENCES "RoundThread"(id) ON DELETE CASCADE,
  side varchar(10) NOT NULL CHECK (side IN ('criador','convidado')),
  body varchar(1000) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "RoundMessage_thread_idx" ON "RoundMessage"("threadId","createdAt");
CREATE INDEX "RoundMessage_created_idx" ON "RoundMessage"("createdAt");

CREATE TABLE "RoundThreadReport" (
  id uuid PRIMARY KEY,
  "threadId" uuid NOT NULL REFERENCES "RoundThread"(id) ON DELETE CASCADE,
  "reporterSide" varchar(10) NOT NULL CHECK ("reporterSide" IN ('criador','convidado')),
  reason varchar(1000) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON "RoundThread" TO orvok_auth_runtime;
    GRANT SELECT,INSERT,DELETE ON "RoundMessage" TO orvok_auth_runtime;
    GRANT SELECT,INSERT ON "RoundThreadReport" TO orvok_auth_runtime;
  END IF;
END $$;

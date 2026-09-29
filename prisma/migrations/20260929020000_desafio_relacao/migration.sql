-- Desafio por tipo de relação: família, amigos ou crush. Define quais perguntas
-- entram no conjunto e o tom do convite.
ALTER TABLE "GuestChallenge" ADD COLUMN "relation" varchar(16) NOT NULL DEFAULT 'amigos';
ALTER TABLE "GuestChallenge" ADD CONSTRAINT guest_challenge_relation CHECK ("relation" IN ('familia','amigos','crush'));

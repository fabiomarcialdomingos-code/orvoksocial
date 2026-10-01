-- Dois produtos: "desafio" (quanto te conhecem: 5 perguntas, o amigo adivinha,
-- placar) e "retrato" (como te veem: 12 perguntas, o amigo opina, anônimo).
ALTER TABLE "GuestChallenge" ADD COLUMN kind varchar(10) NOT NULL DEFAULT 'desafio';
ALTER TABLE "GuestChallenge" ADD CONSTRAINT guest_challenge_kind CHECK (kind IN ('desafio','retrato'));

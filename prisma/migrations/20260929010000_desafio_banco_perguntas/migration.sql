-- Desafio com banco de 100 perguntas: cada desafio guarda as 10 perguntas
-- escolhidas para a pessoa, na ordem em que foram feitas. Quem prevê responde
-- exatamente esse conjunto, e o "desafie de volta" reaproveita o mesmo.
ALTER TABLE "GuestChallenge" ADD COLUMN "questionKeys" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "GuestChallenge" ADD CONSTRAINT guest_challenge_keys_array CHECK (jsonb_typeof("questionKeys") = 'array');

-- Atende um pedido de exclusão (LGPD) nas tabelas de convites, retrato, Mundo e conversas.
-- A exclusão de conta é um pedido manual (DataRequest ERASURE); este script cobre o que
-- NÃO some sozinho quando a conta é apagada, porque os convites ficam só "soltos" (SET NULL).
--
-- Uso (conectado como dono do banco; confira o id em "DataRequest"):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v usuario='UUID-DA-PESSOA' -f scripts/apagar-dados-da-conta.sql
--
-- Tudo roda numa transação e mostra quantas linhas saíram de cada tabela. Para só conferir,
-- troque o COMMIT final por ROLLBACK.
BEGIN;

-- Conversas do Mundo criadas pela pessoa (apaga fios, mensagens e denúncias em cascata).
WITH x AS (DELETE FROM "WorldRound" WHERE "initiatorUserId" = :'usuario'::uuid RETURNING 1) SELECT count(*) AS conversas_do_mundo_criadas FROM x;
-- Conversas do Mundo em que ela foi convidada: apaga a opinião e as mensagens dela, mantendo a conversa da outra pessoa sem a identificação.
WITH m AS (DELETE FROM "RoundMessage" WHERE "threadId" IN (SELECT t.id FROM "RoundThread" t JOIN "WorldRound" w ON w.id=t."roundId" WHERE w."guestUserId" = :'usuario'::uuid) RETURNING 1) SELECT count(*) AS mensagens_como_convidada FROM m;
WITH u AS (UPDATE "WorldRound" SET "guestUserId"=NULL,"guestName"=NULL,"guestTokenHash"=NULL,"guessOpportunityId"=CASE WHEN mode='prever' THEN "guessOpportunityId" ELSE NULL END,"answerOpportunityId"=CASE WHEN mode='prever' THEN NULL ELSE "answerOpportunityId" END WHERE "guestUserId" = :'usuario'::uuid RETURNING 1) SELECT count(*) AS conversas_do_mundo_como_convidada FROM u;

-- Convites criados pela pessoa e as visões anônimas recebidas (cascata), e as visões que ela compartilhou.
WITH a AS (DELETE FROM "GuestChallengeAttempt" WHERE "claimedByUserId" = :'usuario'::uuid RETURNING 1) SELECT count(*) AS visoes_que_ela_compartilhou FROM a;
WITH c AS (DELETE FROM "GuestChallenge" WHERE "claimedByUserId" = :'usuario'::uuid RETURNING 1) SELECT count(*) AS convites_criados FROM c;

-- O que é só dela.
WITH x AS (DELETE FROM "HiddenTrait" WHERE "claimedByUserId" = :'usuario'::uuid RETURNING 1) SELECT count(*) AS tracos_ocultos FROM x;
WITH x AS (DELETE FROM "RetratoSnapshot" WHERE "claimedByUserId" = :'usuario'::uuid RETURNING 1) SELECT count(*) AS evolucao_do_selo FROM x;
WITH x AS (DELETE FROM "PushSubscription" WHERE "userId" = :'usuario'::uuid RETURNING 1) SELECT count(*) AS aparelhos_com_avisos FROM x;
WITH x AS (DELETE FROM "UserAgeConsent" WHERE "userId" = :'usuario'::uuid RETURNING 1) SELECT count(*) AS confirmacao_de_idade FROM x;
WITH x AS (DELETE FROM "GuestReport" WHERE "reporterUserId" = :'usuario'::uuid RETURNING 1) SELECT count(*) AS denuncias_que_fez FROM x;
WITH x AS (DELETE FROM "GuestBlock" WHERE "blockerUserId" = :'usuario'::uuid OR "blockedOwnerUserId" = :'usuario'::uuid RETURNING 1) SELECT count(*) AS bloqueios FROM x;

COMMIT;

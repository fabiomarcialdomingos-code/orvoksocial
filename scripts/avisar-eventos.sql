-- Avisa quem administra o orvok (ADMIN/MODERATOR) quando um evento ainda em
-- rascunho (DRAFT) está a cerca de uma semana de acontecer. Roda uma vez por
-- dia; "notifiedAt" garante que cada evento avisa só uma vez.
WITH alvo AS (
  SELECT id FROM "WorldEvent"
   WHERE status = 'DRAFT' AND "notifiedAt" IS NULL
     AND "closesAt" BETWEEN clock_timestamp() + interval '6 days' AND clock_timestamp() + interval '8 days'
),
admins AS (
  SELECT id FROM "User" WHERE role IN ('ADMIN','MODERATOR') AND status = 'ACTIVE'
),
avisados AS (
  INSERT INTO "Notification" (id,"recipientId","eventType","sourceId","sourceVersion")
  SELECT gen_random_uuid(), admins.id, 'WORLD_EVENT_DRAFT_READY', alvo.id, 1
    FROM alvo CROSS JOIN admins
  ON CONFLICT DO NOTHING
  RETURNING "sourceId"
)
UPDATE "WorldEvent" SET "notifiedAt" = clock_timestamp()
 WHERE id IN (SELECT id FROM alvo);

-- Retenção das conversas privadas: as mensagens são apagadas depois de 90 dias
-- (a Política de privacidade promete isso). Fios sem mensagens ficam só como
-- registro de que a conversa existiu; as denúncias guardam apenas o motivo.
DELETE FROM "RoundMessage" WHERE "createdAt" < clock_timestamp() - interval '90 days';

-- Estante: o registro das decisões da checagem automática (sem a imagem) dura 90 dias, e quem usa a
-- Estante sem conta tem os dados apagados depois de 12 meses sem nenhuma atividade (a Política de
-- privacidade promete os dois prazos). Apagar a pessoa leva junto, em cascata, lembranças, círculo,
-- visitas, fotos e denúncias dela.
DELETE FROM "ShelfModerationLog" WHERE "createdAt" < clock_timestamp() - interval '90 days';
DELETE FROM "ShelfPerson" p
 WHERE p."userId" IS NULL
   AND p."createdAt" < clock_timestamp() - interval '12 months'
   AND NOT EXISTS (SELECT 1 FROM "Keepsake" k WHERE (k."fromId"=p.id OR k."toId"=p.id) AND k."createdAt" > clock_timestamp() - interval '12 months')
   AND NOT EXISTS (SELECT 1 FROM "ShelfVisit" v WHERE (v."ownerId"=p.id OR v."visitorId"=p.id) AND v."createdAt" > clock_timestamp() - interval '12 months');

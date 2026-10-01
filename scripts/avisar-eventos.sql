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

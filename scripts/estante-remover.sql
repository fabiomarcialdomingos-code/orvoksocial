-- Remove uma lembrança denunciada da Estante: ela some para todos, a foto é apagada de verdade e as
-- denúncias dela viram "resolvidas". Não apaga a conta de ninguém.
--
-- Uso: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v lembranca='UUID-DA-LEMBRANCA' -f scripts/estante-remover.sql
BEGIN;
WITH k AS (
  UPDATE "Keepsake" SET state='REMOVED' WHERE id = :'lembranca'::uuid RETURNING id, "imageId"
), f AS (
  DELETE FROM "ShelfImage" WHERE id IN (SELECT "imageId" FROM k WHERE "imageId" IS NOT NULL) RETURNING 1
), r AS (
  UPDATE "ShelfReport" SET state='RESOLVED' WHERE "keepsakeId" = :'lembranca'::uuid AND state='OPEN' RETURNING 1
)
SELECT (SELECT count(*) FROM k) AS lembrancas_removidas, (SELECT count(*) FROM f) AS fotos_apagadas, (SELECT count(*) FROM r) AS denuncias_resolvidas;
COMMIT;

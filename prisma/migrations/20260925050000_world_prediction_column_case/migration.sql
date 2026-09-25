-- "WorldPrediction" was created with unquoted confirmedAt/createdAt, so
-- PostgreSQL folded them to lowercase while the application and the integrity
-- trigger use the quoted camelCase names. Every World prediction failed with
-- 42703. Rename only when the folded names are present (idempotent).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
             AND table_name='WorldPrediction' AND column_name='confirmedat') THEN
    ALTER TABLE "WorldPrediction" RENAME COLUMN confirmedat TO "confirmedAt";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
             AND table_name='WorldPrediction' AND column_name='createdat') THEN
    ALTER TABLE "WorldPrediction" RENAME COLUMN createdat TO "createdAt";
  END IF;
END $$;

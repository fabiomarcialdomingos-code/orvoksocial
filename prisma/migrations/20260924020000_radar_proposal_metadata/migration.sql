ALTER TABLE "QuestionVersion"
  ADD COLUMN "language" varchar(16) NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN "responseType" varchar(32) NOT NULL DEFAULT 'SINGLE_CHOICE',
  ADD COLUMN "sensitivity" varchar(32) NOT NULL DEFAULT 'LOW',
  ADD COLUMN "effectiveAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp();

CREATE OR REPLACE FUNCTION orvok_catalog_version_enabled(p_version uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."QuestionVersion" qv
    JOIN public."Question" q ON q.id=qv."questionId"
    WHERE qv.id=p_version AND q.domain='RADAR' AND
      (qv."catalogStatus"='APPROVED' OR
       (qv."catalogStatus" IN ('TEST_ONLY','PROPOSTA_PARA_APROVACAO')
        AND current_database() ~ '(_dev|_test)$'
        AND EXISTS (SELECT 1 FROM public."RadarCatalogControl" WHERE id=1 AND "allowTestOnly")))
  )
$$;

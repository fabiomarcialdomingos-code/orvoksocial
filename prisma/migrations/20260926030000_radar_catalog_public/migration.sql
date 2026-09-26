-- Public, anonymous read of the published Radar question catalog, used to let
-- an invited visitor guess ALL of the inviter's answers before creating an
-- account. Content only (no per-user data), safe to expose without a session.
CREATE FUNCTION orvok_radar_catalog_public()
RETURNS TABLE("questionVersionId" uuid, text text, options jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT qv.id, qv.text,
    COALESCE(jsonb_agg(jsonb_build_object('id',ao.id,'label',ao.label,'position',ao.position) ORDER BY ao.position) FILTER (WHERE ao.id IS NOT NULL), '[]'::jsonb)
  FROM "QuestionVersion" qv
  JOIN "Question" q ON q.id = qv."questionId"
  LEFT JOIN "AnswerOption" ao ON ao."questionVersionId" = qv.id
  WHERE q.domain='RADAR' AND qv."catalogStatus"='APPROVED'
  GROUP BY qv.id, qv.text
  ORDER BY qv.text
$$;

REVOKE ALL ON FUNCTION orvok_radar_catalog_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_radar_catalog_public() TO orvok_auth_runtime;

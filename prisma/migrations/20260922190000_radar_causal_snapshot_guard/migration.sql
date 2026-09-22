-- Serialize target answer correction against prediction commit, and reject
-- legacy grants/answers that predate exact notice presentation. Historical
-- snapshots are untouched; only new inserts are constrained.
DROP POLICY app_question_select ON "Question";
CREATE POLICY app_question_select ON "Question" FOR SELECT TO orvok_app_runtime
  USING (orvok_read_actor() IS NOT NULL AND EXISTS (
    SELECT 1 FROM "QuestionVersion" qv
    WHERE qv."questionId"="Question".id AND orvok_catalog_version_enabled(qv.id)));

CREATE FUNCTION orvok_radar_current_snapshot_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_target_latest uuid; v_self_latest uuid; v_target_grant public."ConsentGrant";
  v_target_answer_grant public."ConsentGrant"; v_self_answer_grant public."ConsentGrant";
BEGIN
  PERFORM 1 FROM public."User" WHERE id=NEW."targetId" AND status='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'target inactive' USING ERRCODE='23514'; END IF;
  SELECT id INTO v_target_latest FROM public."AnswerVersion"
    WHERE "subjectId"=NEW."targetId" AND "questionVersionId"=NEW."questionVersionId"
    ORDER BY version DESC LIMIT 1;
  SELECT id INTO v_self_latest FROM public."AnswerVersion"
    WHERE "subjectId"=NEW."predictorId" AND "questionVersionId"=NEW."questionVersionId"
    ORDER BY version DESC LIMIT 1;
  IF v_target_latest IS DISTINCT FROM NEW."answerVersionId" OR
     v_self_latest IS DISTINCT FROM NEW."selfAnswerVersionId" THEN
    RAISE EXCEPTION 'current answer version required' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_target_grant FROM public."ConsentGrant" WHERE id=NEW."targetConsentGrantId";
  SELECT g.* INTO v_target_answer_grant FROM public."AnswerVersion" a
    JOIN public."ConsentGrant" g ON g.id=a."consentGrantId" WHERE a.id=NEW."answerVersionId";
  SELECT g.* INTO v_self_answer_grant FROM public."AnswerVersion" a
    JOIN public."ConsentGrant" g ON g.id=a."consentGrantId" WHERE a.id=NEW."selfAnswerVersionId";
  IF v_target_grant."noticePresentationId" IS NULL OR
     v_target_answer_grant."noticePresentationId" IS NULL OR
     v_self_answer_grant."noticePresentationId" IS NULL OR
     v_target_grant."invitationAcceptanceId" IS NULL OR
     NOT EXISTS (SELECT 1 FROM public."ConsentNoticePresentation" p
       WHERE p.id=v_target_grant."noticePresentationId" AND
         p."invitationAcceptanceId"=v_target_grant."invitationAcceptanceId") THEN
    RAISE EXCEPTION 'historical consent cannot authorize new snapshot' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "AAA_radar_current_snapshot_guard" BEFORE INSERT ON "SocialPredictionSnapshot"
  FOR EACH ROW EXECUTE FUNCTION orvok_radar_current_snapshot_guard();
REVOKE ALL ON FUNCTION orvok_radar_current_snapshot_guard() FROM PUBLIC;

CREATE OR REPLACE FUNCTION orvok_radar_opportunities(p_session_hash text)
RETURNS TABLE("targetId" uuid,"grantId" uuid,"questionVersionId" uuid,"selfAnswerVersionId" uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  WITH actor AS (SELECT public.orvok_radar_actor(p_session_hash) AS id)
  SELECT i."targetId",g.id,qv.id,self_answer.id
  FROM actor
  JOIN public."RadarInvitation" i ON i."predictorId"=actor.id
  JOIN public."RadarInvitationAcceptance" a ON a."invitationId"=i.id
  JOIN public."ConsentGrant" g ON g."invitationAcceptanceId"=a.id
    AND g."subjectId"=i."targetId" AND g.purpose='BE_PREDICTED'
  JOIN public."User" target ON target.id=i."targetId" AND target.status='ACTIVE'
  JOIN public."QuestionVersion" qv ON public.orvok_catalog_version_enabled(qv.id)
  JOIN LATERAL (SELECT av.id,av."consentGrantId" FROM public."AnswerVersion" av
    WHERE av."subjectId"=actor.id AND av."questionVersionId"=qv.id
    ORDER BY av.version DESC LIMIT 1) self_answer ON true
  JOIN LATERAL (SELECT av.id,av."consentGrantId",av."answeredAt" FROM public."AnswerVersion" av
    WHERE av."subjectId"=i."targetId" AND av."questionVersionId"=qv.id
    ORDER BY av.version DESC LIMIT 1) target_answer ON true
  JOIN public."ConsentGrant" sg ON sg.id=self_answer."consentGrantId"
  JOIN public."ConsentGrant" tg ON tg.id=target_answer."consentGrantId"
  WHERE g."noticePresentationId" IS NOT NULL AND
    EXISTS (SELECT 1 FROM public."ConsentNoticePresentation" p
      WHERE p.id=g."noticePresentationId" AND p."invitationAcceptanceId"=a.id)
    AND sg."noticePresentationId" IS NOT NULL AND tg."noticePresentationId" IS NOT NULL
    AND target_answer."answeredAt"<clock_timestamp()
    AND NOT EXISTS (SELECT 1 FROM public."ConsentRevocation" r
      WHERE r."grantId" IN (g.id,sg.id,tg.id))
  ORDER BY i."targetId",g.id,qv.id
$$;

CREATE OR REPLACE FUNCTION orvok_radar_mutual_connections(p_session_hash text)
RETURNS TABLE("userId" uuid,"mutualAt" timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  WITH actor AS (SELECT public.orvok_radar_actor(p_session_hash) AS id),
  direction AS (
    SELECT i."predictorId",i."targetId",MAX(a."acceptedAt") AS accepted_at
    FROM public."RadarInvitation" i
    JOIN public."RadarInvitationAcceptance" a ON a."invitationId"=i.id
    JOIN public."ConsentGrant" g ON g."invitationAcceptanceId"=a.id AND g.purpose='BE_PREDICTED'
    JOIN public."ConsentNoticePresentation" p ON p.id=g."noticePresentationId"
      AND p."invitationAcceptanceId"=a.id
    JOIN public."ConsentNotice" n ON n.id=p."noticeId"
    WHERE NOT EXISTS (SELECT 1 FROM public."ConsentRevocation" r WHERE r."grantId"=g.id)
      AND (NOT n."testOnly" OR (current_database() ~ '(_dev|_test)$' AND public.orvok_catalog_test_configured()))
    GROUP BY i."predictorId",i."targetId"
  )
  SELECT forward."targetId",GREATEST(forward.accepted_at,reverse.accepted_at)
  FROM actor
  JOIN direction forward ON forward."predictorId"=actor.id
  JOIN direction reverse ON reverse."predictorId"=forward."targetId" AND reverse."targetId"=actor.id
  JOIN public."User" u ON u.id=forward."targetId" AND u.status='ACTIVE'
  ORDER BY 1
$$;

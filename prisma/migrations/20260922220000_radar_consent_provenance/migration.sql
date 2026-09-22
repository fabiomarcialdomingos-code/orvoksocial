-- Existing TEST/FIXTURE notices accidentally marked as non-test must never
-- authorize future operations, even if a future official question is loaded.
-- No historical row is rewritten or deleted.
CREATE FUNCTION orvok_radar_consent_operational(p_grant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."ConsentGrant" g
    JOIN public."ConsentNoticePresentation" p ON p.id=g."noticePresentationId" AND p."userId"=g."subjectId"
    JOIN public."ConsentNotice" n ON n.id=p."noticeId" AND n.purpose=g.purpose
      AND n.version=g."noticeVersion" AND n."contentHash"=g."noticeHash" AND n.status='APPROVED'
    WHERE g.id=p_grant AND NOT EXISTS
      (SELECT 1 FROM public."ConsentRevocation" r WHERE r."grantId"=g.id)
      AND ((g.purpose='SELF_ANSWER' AND p."invitationAcceptanceId" IS NULL) OR
           (g.purpose='BE_PREDICTED' AND g."invitationAcceptanceId" IS NOT NULL
              AND p."invitationAcceptanceId"=g."invitationAcceptanceId"))
      AND ((NOT n."testOnly" AND n.version !~* '^(TEST|FIXTURE)') OR
           (n."testOnly" AND current_database() ~ '(_dev|_test)$' AND
              public.orvok_catalog_test_configured()))
  )
$$;
REVOKE ALL ON FUNCTION orvok_radar_consent_operational(uuid) FROM PUBLIC;

CREATE FUNCTION orvok_radar_answer_provenance_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."QuestionVersion" qv
    JOIN public."Question" q ON q.id=qv."questionId"
    WHERE qv.id=NEW."questionVersionId" AND q.domain='RADAR') AND
    NOT public.orvok_radar_consent_operational(NEW."consentGrantId") THEN
    RAISE EXCEPTION 'operational answer consent unavailable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "AAA_radar_answer_provenance_guard" BEFORE INSERT ON "AnswerVersion"
  FOR EACH ROW EXECUTE FUNCTION orvok_radar_answer_provenance_guard();
REVOKE ALL ON FUNCTION orvok_radar_answer_provenance_guard() FROM PUBLIC;

CREATE FUNCTION orvok_radar_snapshot_provenance_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_target_answer_grant uuid; v_self_answer_grant uuid;
BEGIN
  SELECT "consentGrantId" INTO v_target_answer_grant FROM public."AnswerVersion" WHERE id=NEW."answerVersionId";
  SELECT "consentGrantId" INTO v_self_answer_grant FROM public."AnswerVersion" WHERE id=NEW."selfAnswerVersionId";
  IF NOT public.orvok_radar_consent_operational(NEW."targetConsentGrantId") OR
     NOT public.orvok_radar_consent_operational(v_target_answer_grant) OR
     NOT public.orvok_radar_consent_operational(v_self_answer_grant) THEN
    RAISE EXCEPTION 'operational radar consent unavailable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "AAB_radar_snapshot_provenance_guard" BEFORE INSERT ON "SocialPredictionSnapshot"
  FOR EACH ROW EXECUTE FUNCTION orvok_radar_snapshot_provenance_guard();
REVOKE ALL ON FUNCTION orvok_radar_snapshot_provenance_guard() FROM PUBLIC;

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
  WHERE target_answer."answeredAt"<clock_timestamp()
    AND public.orvok_radar_consent_operational(g.id)
    AND public.orvok_radar_consent_operational(self_answer."consentGrantId")
    AND public.orvok_radar_consent_operational(target_answer."consentGrantId")
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
    WHERE public.orvok_radar_consent_operational(g.id)
    GROUP BY i."predictorId",i."targetId"
  )
  SELECT forward."targetId",GREATEST(forward.accepted_at,reverse.accepted_at)
  FROM actor
  JOIN direction forward ON forward."predictorId"=actor.id
  JOIN direction reverse ON reverse."predictorId"=forward."targetId" AND reverse."targetId"=actor.id
  JOIN public."User" u ON u.id=forward."targetId" AND u.status='ACTIVE'
  ORDER BY 1
$$;

CREATE OR REPLACE FUNCTION orvok_snapshot_visible(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."SocialPredictionSnapshot" s
    JOIN public."ConsentGrant" g ON g.id=s."targetConsentGrantId"
    JOIN public."AnswerVersion" ta ON ta.id=s."answerVersionId"
    JOIN public."AnswerVersion" sa ON sa.id=s."selfAnswerVersionId"
    JOIN public."User" target ON target.id=s."targetId"
    WHERE s.id=p_id AND target.status='ACTIVE'
      AND public.orvok_catalog_version_enabled(s."questionVersionId")
      AND public.orvok_radar_consent_operational(g.id)
      AND public.orvok_radar_consent_operational(ta."consentGrantId")
      AND public.orvok_radar_consent_operational(sa."consentGrantId")
      AND ((s."predictorId"=public.orvok_read_actor() AND g.scope IN ('PRIVATE','SHARED'))
        OR (s."targetId"=public.orvok_read_actor() AND g.scope='SHARED'))
  )
$$;

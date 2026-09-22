-- A presentation is created once with its acceptance. The prior attempt to
-- fill this column by UPDATE conflicts with the historical append-only guard;
-- no existing presentation is modified here.
CREATE OR REPLACE FUNCTION orvok_radar_present_notice(p_session_hash text,p_purpose "ConsentPurpose",p_acceptance uuid)
RETURNS TABLE(presentation_id uuid,notice_version text,notice_hash text,notice_content text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_actor uuid; v_session uuid; v_accepted timestamptz; v_notice public."ConsentNotice";
BEGIN
  v_actor := public.orvok_radar_actor(p_session_hash);
  IF p_purpose='BE_PREDICTED' THEN
    IF p_acceptance IS NULL THEN RAISE EXCEPTION 'radar acceptance required' USING ERRCODE='23514'; END IF;
    SELECT a."acceptedAt" INTO v_accepted FROM public."RadarInvitationAcceptance" a
      WHERE a.id=p_acceptance AND a."targetId"=v_actor;
    IF v_accepted IS NULL OR v_accepted>=clock_timestamp() THEN
      RAISE EXCEPTION 'radar acceptance unavailable' USING ERRCODE='23514';
    END IF;
  ELSIF p_purpose='SELF_ANSWER' THEN
    IF p_acceptance IS NOT NULL THEN RAISE EXCEPTION 'self answer acceptance invalid' USING ERRCODE='23514'; END IF;
  ELSE
    RAISE EXCEPTION 'notice purpose unavailable' USING ERRCODE='23514';
  END IF;
  SELECT id INTO v_session FROM public."AuthSession" WHERE "tokenHash"=p_session_hash;
  SELECT * INTO v_notice FROM public."ConsentNotice" n
    WHERE n.purpose=p_purpose AND n.status='APPROVED'
      AND (NOT n."testOnly" OR (current_database() ~ '(_dev|_test)$' AND
        public.orvok_catalog_test_configured()))
    ORDER BY n."approvedAt" DESC,n.id DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'notice unavailable' USING ERRCODE='23514'; END IF;
  presentation_id := gen_random_uuid();
  INSERT INTO public."ConsentNoticePresentation"
    (id,"userId","noticeId","sessionId","invitationAcceptanceId","presentedAt")
    VALUES (presentation_id,v_actor,v_notice.id,v_session,p_acceptance,clock_timestamp());
  notice_version := v_notice.version;
  notice_hash := v_notice."contentHash";
  notice_content := v_notice.content;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION orvok_radar_present_notice(p_session_hash text,p_purpose "ConsentPurpose")
RETURNS TABLE(presentation_id uuid,notice_version text,notice_hash text,notice_content text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT * FROM public.orvok_radar_present_notice(p_session_hash,p_purpose,NULL::uuid)
$$;
REVOKE ALL ON FUNCTION orvok_radar_present_notice(text,"ConsentPurpose"),
  orvok_radar_present_notice(text,"ConsentPurpose",uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_radar_present_notice(text,"ConsentPurpose"),
  orvok_radar_present_notice(text,"ConsentPurpose",uuid) TO orvok_app_runtime;

-- A test-only snapshot must disappear from operational reads as soon as the
-- fixture switch is disabled, while its immutable history remains for audit.
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
      AND NOT EXISTS (SELECT 1 FROM public."ConsentRevocation" r
        WHERE r."grantId" IN (g.id,ta."consentGrantId",sa."consentGrantId"))
      AND ((s."predictorId"=public.orvok_read_actor() AND g.scope IN ('PRIVATE','SHARED'))
        OR (s."targetId"=public.orvok_read_actor() AND g.scope='SHARED'))
  )
$$;

DROP FUNCTION orvok_read_snapshot(uuid);
CREATE FUNCTION orvok_read_snapshot(p_id uuid)
RETURNS TABLE(id uuid,"predictorId" uuid,"targetId" uuid,"questionVersionId" uuid,
  "probabilityVector" jsonb,"predictedAt" timestamptz,"targetConsentGrantId" uuid,
  "targetConsentVersion" integer,scope "VisibilityScope",active boolean,"snapshotHash" varchar(64))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT s.id,s."predictorId",s."targetId",s."questionVersionId",s."probabilityVector",
    s."predictedAt",s."targetConsentGrantId",s."targetConsentVersion",g.scope,true,s."snapshotHash"
  FROM public."SocialPredictionSnapshot" s JOIN public."ConsentGrant" g ON g.id=s."targetConsentGrantId"
  WHERE s.id=p_id AND public.orvok_snapshot_visible(s.id)
$$;
REVOKE ALL ON FUNCTION orvok_read_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_read_snapshot(uuid) TO orvok_app_runtime;

CREATE FUNCTION orvok_catalog_test_material_present() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public."QuestionVersion" WHERE "catalogStatus"='TEST_ONLY')
    OR EXISTS (SELECT 1 FROM public."ConsentNotice" WHERE "testOnly")
    OR public.orvok_catalog_test_configured()
$$;
REVOKE ALL ON FUNCTION orvok_catalog_test_material_present() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_catalog_test_material_present() TO orvok_app_runtime;

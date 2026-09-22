-- Historical local fixtures inserted before testOnly existed are rejected by
-- operational selection. New fixture-like versions must be marked TEST_ONLY.
ALTER TABLE "ConsentNotice" ADD CONSTRAINT "ConsentNotice_fixture_provenance"
  CHECK (version !~* '^(TEST|FIXTURE)' OR "testOnly") NOT VALID;

DROP POLICY app_notice_select ON "ConsentNotice";
CREATE POLICY app_notice_select ON "ConsentNotice" FOR SELECT TO orvok_app_runtime
  USING (status='APPROVED' AND orvok_read_actor() IS NOT NULL AND
    ((NOT "testOnly" AND version !~* '^(TEST|FIXTURE)') OR
     ("testOnly" AND current_database() ~ '(_dev|_test)$' AND orvok_catalog_test_configured())));

CREATE OR REPLACE FUNCTION orvok_test_notice_grant_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."ConsentNotice" n
    WHERE n.purpose=NEW.purpose AND n.version=NEW."noticeVersion" AND n."contentHash"=NEW."noticeHash"
      AND (n."testOnly" OR n.version ~* '^(TEST|FIXTURE)')
      AND NOT (current_database() ~ '(_dev|_test)$' AND
        EXISTS (SELECT 1 FROM public."RadarCatalogControl" WHERE id=1 AND "allowTestOnly"))
  ) THEN RAISE EXCEPTION 'test consent notice unavailable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;

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
      AND ((NOT n."testOnly" AND n.version !~* '^(TEST|FIXTURE)') OR
        (n."testOnly" AND current_database() ~ '(_dev|_test)$' AND
          public.orvok_catalog_test_configured()))
    ORDER BY CASE WHEN NOT n."testOnly" THEN 0
      WHEN n.version='TEST_ONLY_'||p_purpose::text||'_V1' THEN 1 ELSE 2 END,
      n."approvedAt" DESC,n.id DESC LIMIT 1;
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

CREATE OR REPLACE FUNCTION orvok_catalog_test_material_present() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public."QuestionVersion" WHERE "catalogStatus"='TEST_ONLY')
    OR EXISTS (SELECT 1 FROM public."ConsentNotice" WHERE "testOnly" OR version ~* '^(TEST|FIXTURE)')
    OR public.orvok_catalog_test_configured()
$$;

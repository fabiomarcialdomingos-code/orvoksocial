-- Make candidate/test material invisible to the runtime role unless the
-- owner explicitly enabled fixtures in a local _dev/_test database.
DROP POLICY app_question_select ON "Question";
CREATE POLICY app_question_select ON "Question" FOR SELECT TO orvok_app_runtime
  USING (orvok_read_actor() IS NOT NULL AND EXISTS (
    SELECT 1 FROM "QuestionVersion" qv
    WHERE qv."questionId"=id AND orvok_catalog_version_enabled(qv.id)));
DROP POLICY app_question_version_select ON "QuestionVersion";
CREATE POLICY app_question_version_select ON "QuestionVersion" FOR SELECT TO orvok_app_runtime
  USING (orvok_read_actor() IS NOT NULL AND orvok_catalog_version_enabled(id));
DROP POLICY app_option_select ON "AnswerOption";
CREATE POLICY app_option_select ON "AnswerOption" FOR SELECT TO orvok_app_runtime
  USING (orvok_read_actor() IS NOT NULL AND orvok_catalog_version_enabled("questionVersionId"));
DROP POLICY app_notice_select ON "ConsentNotice";
CREATE POLICY app_notice_select ON "ConsentNotice" FOR SELECT TO orvok_app_runtime
  USING (status='APPROVED' AND orvok_read_actor() IS NOT NULL AND
    (NOT "testOnly" OR (current_database() ~ '(_dev|_test)$' AND orvok_catalog_test_configured())));

-- One initial snapshot per predictor-target-item version. Revisions form a
-- single append-only chain via the existing unique supersedesId constraint.
CREATE UNIQUE INDEX "SocialPredictionSnapshot_one_root_per_pair_item" ON "SocialPredictionSnapshot"
  ("predictorId","targetId","questionVersionId") WHERE "supersedesId" IS NULL;

-- Bind new presentations to the exact accepted invitation. Existing
-- append-only presentations remain untouched; their historical grants retain
-- the acceptance reference stored on ConsentGrant.
ALTER TABLE "ConsentNoticePresentation" ADD COLUMN "invitationAcceptanceId" uuid;
ALTER TABLE "ConsentNoticePresentation" ADD CONSTRAINT "ConsentNoticePresentation_acceptance_target_fkey"
  FOREIGN KEY ("invitationAcceptanceId","userId")
  REFERENCES "RadarInvitationAcceptance"(id,"targetId") ON DELETE RESTRICT NOT VALID;
ALTER TABLE "ConsentNoticePresentation" VALIDATE CONSTRAINT "ConsentNoticePresentation_acceptance_target_fkey";

CREATE FUNCTION orvok_radar_presentation_acceptance_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_link uuid;
BEGIN
  IF NEW.purpose='BE_PREDICTED' THEN
    SELECT p."invitationAcceptanceId" INTO v_link
      FROM public."ConsentNoticePresentation" p WHERE p.id=NEW."noticePresentationId";
    IF v_link IS NULL OR v_link IS DISTINCT FROM NEW."invitationAcceptanceId" THEN
      RAISE EXCEPTION 'notice presented for another invitation' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER radar_presentation_acceptance_guard BEFORE INSERT ON "ConsentGrant"
  FOR EACH ROW EXECUTE FUNCTION orvok_radar_presentation_acceptance_guard();
REVOKE ALL ON FUNCTION orvok_radar_presentation_acceptance_guard() FROM PUBLIC;

CREATE OR REPLACE FUNCTION orvok_radar_present_notice(p_session_hash text,p_purpose "ConsentPurpose")
RETURNS TABLE(presentation_id uuid,notice_version text,notice_hash text,notice_content text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_purpose<>'SELF_ANSWER' THEN
    RAISE EXCEPTION 'invitation acceptance required' USING ERRCODE='23514';
  END IF;
  RETURN QUERY SELECT * FROM public.orvok_radar_present_notice_core(p_session_hash,p_purpose);
END;
$$;

CREATE FUNCTION orvok_radar_present_notice(p_session_hash text,p_purpose "ConsentPurpose",p_acceptance uuid)
RETURNS TABLE(presentation_id uuid,notice_version text,notice_hash text,notice_content text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_actor uuid; v_accepted timestamptz;
BEGIN
  IF p_purpose<>'BE_PREDICTED' OR p_acceptance IS NULL THEN
    RAISE EXCEPTION 'radar acceptance required' USING ERRCODE='23514';
  END IF;
  v_actor := public.orvok_radar_actor(p_session_hash);
  SELECT a."acceptedAt" INTO v_accepted FROM public."RadarInvitationAcceptance" a
    WHERE a.id=p_acceptance AND a."targetId"=v_actor;
  IF v_accepted IS NULL OR v_accepted>=clock_timestamp() THEN
    RAISE EXCEPTION 'radar acceptance unavailable' USING ERRCODE='23514';
  END IF;
  SELECT c.presentation_id,c.notice_version,c.notice_hash,c.notice_content
    INTO presentation_id,notice_version,notice_hash,notice_content
    FROM public.orvok_radar_present_notice_core(p_session_hash,p_purpose) c;
  UPDATE public."ConsentNoticePresentation" SET "invitationAcceptanceId"=p_acceptance
    WHERE id=presentation_id AND "userId"=v_actor AND "presentedAt">v_accepted;
  IF NOT FOUND THEN RAISE EXCEPTION 'notice order invalid' USING ERRCODE='23514'; END IF;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION orvok_radar_present_notice(text,"ConsentPurpose",uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_radar_present_notice(text,"ConsentPurpose",uuid) TO orvok_app_runtime;

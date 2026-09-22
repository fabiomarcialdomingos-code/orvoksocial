-- APP_DATABASE_URL is an untrusted runtime role. Every personal read requires
-- a valid session hash scoped to its own database connection. The app role
-- cannot read AuthSession.tokenHash and cannot impersonate another actor by
-- setting an arbitrary user id.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_app_runtime') THEN
    CREATE ROLE orvok_app_runtime NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_auth_runtime') THEN
    CREATE ROLE orvok_auth_runtime NOLOGIN NOINHERIT;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION orvok_read_actor() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT s."userId" FROM public."AuthSession" s
  JOIN public."User" u ON u.id=s."userId"
  JOIN public."AuthIdentity" ai ON ai."userId"=u.id
  WHERE s."tokenHash"=current_setting('orvok.session_hash',true)
    AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp()
    AND u.status='ACTIVE' AND ai."verifiedAt" IS NOT NULL
  LIMIT 1
$$;
CREATE OR REPLACE FUNCTION orvok_read_role() RETURNS "UserRole"
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT role FROM public."User" WHERE id=public.orvok_read_actor()
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
      AND NOT EXISTS (SELECT 1 FROM public."ConsentRevocation" r
        WHERE r."grantId" IN (g.id,ta."consentGrantId",sa."consentGrantId"))
      AND ((s."predictorId"=public.orvok_read_actor() AND g.scope IN ('PRIVATE','SHARED'))
        OR (s."targetId"=public.orvok_read_actor() AND g.scope='SHARED'))
  )
$$;
CREATE FUNCTION orvok_read_snapshot(p_id uuid)
RETURNS TABLE(id uuid,"predictorId" uuid,"targetId" uuid,"questionVersionId" uuid,
  "probabilityVector" jsonb,"predictedAt" timestamptz,"targetConsentGrantId" uuid,
  "targetConsentVersion" integer,scope "VisibilityScope",active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT s.id,s."predictorId",s."targetId",s."questionVersionId",s."probabilityVector",
    s."predictedAt",s."targetConsentGrantId",s."targetConsentVersion",g.scope,true
  FROM public."SocialPredictionSnapshot" s JOIN public."ConsentGrant" g ON g.id=s."targetConsentGrantId"
  WHERE s.id=p_id AND public.orvok_snapshot_visible(s.id)
$$;
CREATE FUNCTION orvok_export_restricted_predictions(p_cursor uuid)
RETURNS TABLE(id uuid,"predictedAt" timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT s.id,s."predictedAt" FROM public."SocialPredictionSnapshot" s
  WHERE s."predictorId"=public.orvok_read_actor() AND s.id>p_cursor
    AND NOT public.orvok_snapshot_visible(s.id)
  ORDER BY s.id LIMIT 100
$$;
CREATE FUNCTION orvok_export_received_predictions(p_cursor uuid)
RETURNS TABLE(id uuid,"questionVersionId" uuid,"predictedAt" timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT s.id,s."questionVersionId",s."predictedAt" FROM public."SocialPredictionSnapshot" s
  WHERE s."targetId"=public.orvok_read_actor() AND s.id>p_cursor
  ORDER BY s.id LIMIT 100
$$;
REVOKE ALL ON FUNCTION orvok_read_actor(),orvok_read_role(),orvok_snapshot_visible(uuid),
  orvok_read_snapshot(uuid),orvok_export_restricted_predictions(uuid),
  orvok_export_received_predictions(uuid) FROM PUBLIC;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_user_select ON "User" FOR SELECT TO orvok_app_runtime
  USING (id=orvok_read_actor());
CREATE POLICY auth_user_all ON "User" FOR ALL TO orvok_auth_runtime
  USING (true) WITH CHECK (true);
ALTER TABLE "AuthIdentity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_identity_select ON "AuthIdentity" FOR SELECT TO orvok_app_runtime
  USING ("userId"=orvok_read_actor());
CREATE POLICY auth_identity_all ON "AuthIdentity" FOR ALL TO orvok_auth_runtime
  USING (true) WITH CHECK (true);
ALTER TABLE "Question" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_question_select ON "Question" FOR SELECT TO orvok_app_runtime
  USING (orvok_read_actor() IS NOT NULL);
ALTER TABLE "QuestionVersion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_question_version_select ON "QuestionVersion" FOR SELECT TO orvok_app_runtime
  USING (orvok_read_actor() IS NOT NULL);
ALTER TABLE "AnswerOption" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_option_select ON "AnswerOption" FOR SELECT TO orvok_app_runtime
  USING (orvok_read_actor() IS NOT NULL);
ALTER TABLE "ConsentNotice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_notice_select ON "ConsentNotice" FOR SELECT TO orvok_app_runtime
  USING (status='APPROVED' AND orvok_read_actor() IS NOT NULL);
ALTER TABLE "ConsentNoticePresentation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_presentation_select ON "ConsentNoticePresentation" FOR SELECT TO orvok_app_runtime
  USING ("userId"=orvok_read_actor());
ALTER TABLE "RadarInvitation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_invitation_select ON "RadarInvitation" FOR SELECT TO orvok_app_runtime
  USING ("predictorId"=orvok_read_actor() OR "targetId"=orvok_read_actor());
ALTER TABLE "RadarInvitationAcceptance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_acceptance_select ON "RadarInvitationAcceptance" FOR SELECT TO orvok_app_runtime
  USING ("targetId"=orvok_read_actor() OR EXISTS (
    SELECT 1 FROM "RadarInvitation" i WHERE i.id="invitationId" AND i."predictorId"=orvok_read_actor()));
ALTER TABLE "ConsentGrant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_grant_select ON "ConsentGrant" FOR SELECT TO orvok_app_runtime
  USING ("subjectId"=orvok_read_actor());
ALTER TABLE "ConsentRevocation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_revocation_select ON "ConsentRevocation" FOR SELECT TO orvok_app_runtime
  USING ("subjectId"=orvok_read_actor());
ALTER TABLE "AnswerVersion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_answer_select ON "AnswerVersion" FOR SELECT TO orvok_app_runtime
  USING ("subjectId"=orvok_read_actor());
ALTER TABLE "SocialPredictionSnapshot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_snapshot_select ON "SocialPredictionSnapshot" FOR SELECT TO orvok_app_runtime
  USING (orvok_snapshot_visible(id));
ALTER TABLE "DataRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_data_request_select ON "DataRequest" FOR SELECT TO orvok_app_runtime
  USING ("subjectId"=orvok_read_actor());
CREATE POLICY app_data_request_insert ON "DataRequest" FOR INSERT TO orvok_app_runtime
  WITH CHECK ("subjectId"=orvok_read_actor());
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_notification_select ON "Notification" FOR SELECT TO orvok_app_runtime
  USING ("recipientId"=orvok_read_actor());
ALTER TABLE "ApiIdempotency" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_idempotency_select ON "ApiIdempotency" FOR SELECT TO orvok_app_runtime
  USING ("actorId"=orvok_read_actor());
CREATE POLICY app_idempotency_insert ON "ApiIdempotency" FOR INSERT TO orvok_app_runtime
  WITH CHECK ("actorId"=orvok_read_actor());
CREATE POLICY app_idempotency_update ON "ApiIdempotency" FOR UPDATE TO orvok_app_runtime
  USING ("actorId"=orvok_read_actor()) WITH CHECK ("actorId"=orvok_read_actor());
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_audit_select ON "AuditLog" FOR SELECT TO orvok_app_runtime
  USING ("actorId"=orvok_read_actor() OR orvok_read_role()='ADMIN');
CREATE POLICY app_audit_insert ON "AuditLog" FOR INSERT TO orvok_app_runtime
  WITH CHECK ("actorId"=orvok_read_actor() AND action IN
    ('API_MUTATION_BLOCKED','DATA_EXPORT','DATA_ERASURE_REQUESTED','DATA_EXPORT_REQUESTED'));
CREATE POLICY auth_audit_all ON "AuditLog" FOR ALL TO orvok_auth_runtime
  USING (true) WITH CHECK (true);

-- Catalog versions remain immutable. Official publication is a separate,
-- reviewed owner-side operation; application credentials cannot promote data.
CREATE TYPE "RadarCatalogStatus" AS ENUM ('TEST_ONLY','CANDIDATE','APPROVED');
ALTER TABLE "QuestionVersion" ADD COLUMN "instrumentVersion" varchar(80) NOT NULL DEFAULT 'TEST_ONLY_LEGACY';
ALTER TABLE "QuestionVersion" ADD COLUMN "catalogStatus" "RadarCatalogStatus" NOT NULL DEFAULT 'TEST_ONLY';
ALTER TABLE "QuestionVersion" ADD COLUMN "approvedAt" timestamptz(6);
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_catalog_approval" CHECK
  (("catalogStatus"='APPROVED' AND "approvedAt" IS NOT NULL AND "instrumentVersion"<>'TEST_ONLY_LEGACY') OR
   ("catalogStatus"<>'APPROVED' AND "approvedAt" IS NULL));
CREATE TABLE "RadarCatalogControl" (
  id integer PRIMARY KEY CHECK (id=1),
  "allowTestOnly" boolean NOT NULL DEFAULT false,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO "RadarCatalogControl" (id,"allowTestOnly") VALUES (1,false);
ALTER TABLE "ConsentNotice" ADD COLUMN "testOnly" boolean NOT NULL DEFAULT false;
ALTER TABLE "RadarInvitation" ADD COLUMN "expiresAt" timestamptz(6);
ALTER TABLE "RadarInvitation" ADD CONSTRAINT "RadarInvitation_valid_expiry" CHECK
  ("expiresAt" IS NULL OR "expiresAt">"invitedAt");

CREATE FUNCTION orvok_test_notice_grant_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."ConsentNotice" n
    WHERE n.purpose=NEW.purpose AND n.version=NEW."noticeVersion" AND n."contentHash"=NEW."noticeHash"
      AND n."testOnly" AND NOT (current_database() ~ '(_dev|_test)$' AND
        EXISTS (SELECT 1 FROM public."RadarCatalogControl" WHERE id=1 AND "allowTestOnly"))
  ) THEN RAISE EXCEPTION 'test consent notice unavailable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER radar_test_notice_grant_guard BEFORE INSERT ON "ConsentGrant"
FOR EACH ROW EXECUTE FUNCTION orvok_test_notice_grant_guard();
REVOKE ALL ON FUNCTION orvok_test_notice_grant_guard() FROM PUBLIC;

CREATE FUNCTION orvok_catalog_version_enabled(p_version uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."QuestionVersion" qv
    JOIN public."Question" q ON q.id=qv."questionId"
    WHERE qv.id=p_version AND q.domain='RADAR' AND
      (qv."catalogStatus"='APPROVED' OR
       (qv."catalogStatus"='TEST_ONLY' AND current_database() ~ '(_dev|_test)$' AND EXISTS
         (SELECT 1 FROM public."RadarCatalogControl" WHERE id=1 AND "allowTestOnly")))
  )
$$;
REVOKE ALL ON FUNCTION orvok_catalog_version_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_catalog_version_enabled(uuid) TO orvok_app_runtime;
CREATE FUNCTION orvok_catalog_test_configured() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public."RadarCatalogControl" WHERE id=1 AND "allowTestOnly")
$$;
REVOKE ALL ON FUNCTION orvok_catalog_test_configured() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_catalog_test_configured() TO orvok_app_runtime;

-- A pair is serialized before checking an outstanding invitation. NULL expiry
-- means no product TTL has been ratified; explicit test fixtures may expire.
CREATE OR REPLACE FUNCTION orvok_radar_invite(p_session_hash text,p_target uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_actor uuid; v_id uuid := gen_random_uuid();
BEGIN
  v_actor := public.orvok_radar_actor(p_session_hash);
  IF v_actor=p_target OR NOT EXISTS (SELECT 1 FROM public."User" WHERE id=p_target AND status='ACTIVE') THEN
    RAISE EXCEPTION 'invalid radar target' USING ERRCODE='23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||p_target::text,0));
  IF EXISTS (
    SELECT 1 FROM public."RadarInvitation" i
    LEFT JOIN public."RadarInvitationAcceptance" a ON a."invitationId"=i.id
    WHERE i."predictorId"=v_actor AND i."targetId"=p_target
      AND (a.id IS NOT NULL OR i."expiresAt" IS NULL OR i."expiresAt">clock_timestamp())
  ) THEN RAISE EXCEPTION 'duplicate radar invitation' USING ERRCODE='23505'; END IF;
  INSERT INTO public."RadarInvitation" (id,"predictorId","targetId","invitedAt")
    VALUES (v_id,v_actor,p_target,clock_timestamp());
  INSERT INTO public."AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES (gen_random_uuid(),v_actor,'RADAR_INVITED','RadarInvitation',v_id,clock_timestamp());
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION orvok_radar_accept(p_session_hash text,p_invitation uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_actor uuid; v_id uuid := gen_random_uuid(); v_invited timestamptz; v_expiry timestamptz;
BEGIN
  v_actor := public.orvok_radar_actor(p_session_hash);
  SELECT "invitedAt","expiresAt" INTO v_invited,v_expiry FROM public."RadarInvitation"
    WHERE id=p_invitation AND "targetId"=v_actor FOR UPDATE;
  IF v_invited IS NULL OR v_invited>=clock_timestamp() OR
    (v_expiry IS NOT NULL AND v_expiry<=clock_timestamp()) THEN
    RAISE EXCEPTION 'invitation unavailable' USING ERRCODE='23514';
  END IF;
  INSERT INTO public."RadarInvitationAcceptance" (id,"invitationId","targetId","acceptedAt")
    VALUES (v_id,p_invitation,v_actor,clock_timestamp());
  INSERT INTO public."AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES (gen_random_uuid(),v_actor,'RADAR_INVITATION_ACCEPTED','RadarInvitation',p_invitation,clock_timestamp());
  RETURN v_id;
END;
$$;

CREATE FUNCTION orvok_radar_operational_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_recipient uuid; v_type text; v_source uuid;
BEGIN
  IF TG_TABLE_NAME='RadarInvitation' THEN
    v_recipient := NEW."targetId"; v_type := 'RADAR_INVITATION_RECEIVED'; v_source := NEW.id;
  ELSIF TG_TABLE_NAME='RadarInvitationAcceptance' THEN
    SELECT "predictorId" INTO v_recipient FROM public."RadarInvitation" WHERE id=NEW."invitationId";
    v_type := 'RADAR_INVITATION_ACCEPTED'; v_source := NEW."invitationId";
  ELSIF TG_TABLE_NAME='ConsentRevocation' THEN
    SELECT i."predictorId" INTO v_recipient
      FROM public."ConsentGrant" g
      JOIN public."RadarInvitationAcceptance" a ON a.id=g."invitationAcceptanceId"
      JOIN public."RadarInvitation" i ON i.id=a."invitationId"
      WHERE g.id=NEW."grantId" AND g.purpose='BE_PREDICTED';
    v_type := 'RADAR_CONSENT_REVOKED'; v_source := NEW."grantId";
  END IF;
  IF v_recipient IS NOT NULL THEN
    INSERT INTO public."Notification" (id,"recipientId","eventType","sourceId","sourceVersion")
      VALUES (gen_random_uuid(),v_recipient,v_type,v_source,1)
      ON CONFLICT ("recipientId","eventType","sourceId","sourceVersion") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER radar_invite_operational_notice AFTER INSERT ON "RadarInvitation"
FOR EACH ROW EXECUTE FUNCTION orvok_radar_operational_notification();
CREATE TRIGGER radar_accept_operational_notice AFTER INSERT ON "RadarInvitationAcceptance"
FOR EACH ROW EXECUTE FUNCTION orvok_radar_operational_notification();
CREATE TRIGGER radar_revoke_operational_notice AFTER INSERT ON "ConsentRevocation"
FOR EACH ROW EXECUTE FUNCTION orvok_radar_operational_notification();
REVOKE ALL ON FUNCTION orvok_radar_operational_notification() FROM PUBLIC;

-- Preserve the reviewed temporal/consent RPC bodies, interposing only an
-- owner-controlled catalog gate. Core entry points are not callable by app.
ALTER FUNCTION orvok_radar_answer(text,uuid,uuid,uuid,uuid) RENAME TO orvok_radar_answer_core;
ALTER FUNCTION orvok_radar_predict(text,uuid,uuid,uuid,uuid,jsonb,uuid) RENAME TO orvok_radar_predict_core;
ALTER FUNCTION orvok_radar_present_notice(text,"ConsentPurpose") RENAME TO orvok_radar_present_notice_core;
REVOKE ALL ON FUNCTION orvok_radar_answer_core(text,uuid,uuid,uuid,uuid),
  orvok_radar_predict_core(text,uuid,uuid,uuid,uuid,jsonb,uuid),
  orvok_radar_present_notice_core(text,"ConsentPurpose")
  FROM PUBLIC,orvok_app_runtime,orvok_auth_runtime;
CREATE FUNCTION orvok_radar_present_notice(p_session_hash text,p_purpose "ConsentPurpose")
RETURNS TABLE(presentation_id uuid,notice_version text,notice_hash text,notice_content text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  SELECT c.presentation_id,c.notice_version,c.notice_hash,c.notice_content
    INTO presentation_id,notice_version,notice_hash,notice_content
    FROM public.orvok_radar_present_notice_core(p_session_hash,p_purpose) c;
  IF EXISTS (
    SELECT 1 FROM public."ConsentNoticePresentation" p
    JOIN public."ConsentNotice" n ON n.id=p."noticeId"
    WHERE p.id=presentation_id AND n."testOnly"
      AND NOT (current_database() ~ '(_dev|_test)$' AND
        EXISTS (SELECT 1 FROM public."RadarCatalogControl" WHERE id=1 AND "allowTestOnly"))
  ) THEN RAISE EXCEPTION 'test notice unavailable' USING ERRCODE='23514'; END IF;
  RETURN NEXT;
END;
$$;
CREATE FUNCTION orvok_radar_answer(p_session_hash text,p_question uuid,p_option uuid,p_grant uuid,p_supersedes uuid)
RETURNS TABLE(answer_id uuid,answer_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT public.orvok_catalog_version_enabled(p_question) THEN
    RAISE EXCEPTION 'radar catalog unavailable' USING ERRCODE='23514';
  END IF;
  RETURN QUERY SELECT * FROM public.orvok_radar_answer_core(p_session_hash,p_question,p_option,p_grant,p_supersedes);
END;
$$;
CREATE FUNCTION orvok_radar_predict(p_session_hash text,p_target uuid,p_question uuid,p_self_answer uuid,
  p_grant uuid,p_vector jsonb,p_supersedes uuid)
RETURNS TABLE(snapshot_id uuid,consent_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT public.orvok_catalog_version_enabled(p_question) THEN
    RAISE EXCEPTION 'radar catalog unavailable' USING ERRCODE='23514';
  END IF;
  RETURN QUERY SELECT * FROM public.orvok_radar_predict_core(
    p_session_hash,p_target,p_question,p_self_answer,p_grant,p_vector,p_supersedes);
END;
$$;
REVOKE ALL ON FUNCTION orvok_radar_answer(text,uuid,uuid,uuid,uuid),
  orvok_radar_predict(text,uuid,uuid,uuid,uuid,jsonb,uuid),
  orvok_radar_present_notice(text,"ConsentPurpose") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_radar_answer(text,uuid,uuid,uuid,uuid),
  orvok_radar_predict(text,uuid,uuid,uuid,uuid,jsonb,uuid),
  orvok_radar_present_notice(text,"ConsentPurpose") TO orvok_app_runtime;

-- These functions return only identifiers needed to prepare a prediction.
-- The target's option and answer version are deliberately absent.
CREATE FUNCTION orvok_radar_opportunities(p_session_hash text)
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
  JOIN LATERAL (SELECT av.id FROM public."AnswerVersion" av
    WHERE av."subjectId"=actor.id AND av."questionVersionId"=qv.id
      AND NOT EXISTS (SELECT 1 FROM public."ConsentRevocation" r WHERE r."grantId"=av."consentGrantId")
    ORDER BY av.version DESC LIMIT 1) self_answer ON true
  WHERE NOT EXISTS (SELECT 1 FROM public."ConsentRevocation" r WHERE r."grantId"=g.id)
    AND EXISTS (SELECT 1 FROM public."AnswerVersion" av
      WHERE av."subjectId"=i."targetId" AND av."questionVersionId"=qv.id
        AND av."answeredAt"<clock_timestamp()
        AND NOT EXISTS (SELECT 1 FROM public."ConsentRevocation" r WHERE r."grantId"=av."consentGrantId"))
  ORDER BY i."targetId",g.id,qv.id
$$;
REVOKE ALL ON FUNCTION orvok_radar_opportunities(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_radar_opportunities(text) TO orvok_app_runtime;

-- "Match" here is solely a reciprocal, currently consented relationship.
-- No compatibility inference, probability, Score or ranking is produced.
CREATE FUNCTION orvok_radar_mutual_connections(p_session_hash text)
RETURNS TABLE("userId" uuid,"mutualAt" timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  WITH actor AS (SELECT public.orvok_radar_actor(p_session_hash) AS id),
  direction AS (
    SELECT i."predictorId",i."targetId",MAX(a."acceptedAt") AS accepted_at
    FROM public."RadarInvitation" i
    JOIN public."RadarInvitationAcceptance" a ON a."invitationId"=i.id
    JOIN public."ConsentGrant" g ON g."invitationAcceptanceId"=a.id
      AND g.purpose='BE_PREDICTED'
    WHERE NOT EXISTS (SELECT 1 FROM public."ConsentRevocation" r WHERE r."grantId"=g.id)
    GROUP BY i."predictorId",i."targetId"
  )
  SELECT forward."targetId",GREATEST(forward.accepted_at,reverse.accepted_at)
  FROM actor
  JOIN direction forward ON forward."predictorId"=actor.id
  JOIN direction reverse ON reverse."predictorId"=forward."targetId" AND reverse."targetId"=actor.id
  JOIN public."User" u ON u.id=forward."targetId" AND u.status='ACTIVE'
  ORDER BY 1
$$;
REVOKE ALL ON FUNCTION orvok_radar_mutual_connections(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_radar_mutual_connections(text) TO orvok_app_runtime;

-- All Radar writes cross an authenticated SECURITY DEFINER boundary. Runtime
-- credentials are provisioned separately and never own these objects.
CREATE FUNCTION orvok_radar_actor(p_session_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid;
BEGIN
  IF p_session_hash IS NULL OR p_session_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid session' USING ERRCODE='28000';
  END IF;
  SELECT s."userId" INTO v_actor
  FROM "AuthSession" s
  JOIN "User" u ON u.id=s."userId"
  JOIN "AuthIdentity" ai ON ai."userId"=u.id
  WHERE s."tokenHash"=p_session_hash AND s."revokedAt" IS NULL
    AND s."expiresAt">clock_timestamp() AND u.status='ACTIVE'
    AND ai."verifiedAt" IS NOT NULL;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'invalid session' USING ERRCODE='28000';
  END IF;
  RETURN v_actor;
END;
$$;

CREATE FUNCTION orvok_radar_invite(p_session_hash text,p_target uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_id uuid := gen_random_uuid();
BEGIN
  v_actor := orvok_radar_actor(p_session_hash);
  IF v_actor=p_target OR NOT EXISTS (SELECT 1 FROM "User" WHERE id=p_target AND status='ACTIVE') THEN
    RAISE EXCEPTION 'invalid radar target' USING ERRCODE='23514';
  END IF;
  INSERT INTO "RadarInvitation" (id,"predictorId","targetId","invitedAt")
    VALUES (v_id,v_actor,p_target,clock_timestamp());
  INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES (gen_random_uuid(),v_actor,'RADAR_INVITED','RadarInvitation',v_id,clock_timestamp());
  RETURN v_id;
END;
$$;

CREATE FUNCTION orvok_radar_accept(p_session_hash text,p_invitation uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_id uuid := gen_random_uuid(); v_invited timestamptz;
BEGIN
  v_actor := orvok_radar_actor(p_session_hash);
  SELECT "invitedAt" INTO v_invited FROM "RadarInvitation"
    WHERE id=p_invitation AND "targetId"=v_actor FOR UPDATE;
  IF v_invited IS NULL OR v_invited>=clock_timestamp() THEN
    RAISE EXCEPTION 'invitation unavailable' USING ERRCODE='23514';
  END IF;
  INSERT INTO "RadarInvitationAcceptance" (id,"invitationId","targetId","acceptedAt")
    VALUES (v_id,p_invitation,v_actor,clock_timestamp());
  INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES (gen_random_uuid(),v_actor,'RADAR_INVITATION_ACCEPTED','RadarInvitation',p_invitation,clock_timestamp());
  RETURN v_id;
END;
$$;

CREATE FUNCTION orvok_radar_present_notice(p_session_hash text,p_purpose "ConsentPurpose")
RETURNS TABLE(presentation_id uuid,notice_version text,notice_hash text,notice_content text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_session uuid; v_notice "ConsentNotice"; v_id uuid := gen_random_uuid();
BEGIN
  v_actor := orvok_radar_actor(p_session_hash);
  SELECT id INTO v_session FROM "AuthSession" WHERE "tokenHash"=p_session_hash;
  SELECT * INTO v_notice FROM "ConsentNotice"
    WHERE purpose=p_purpose AND status='APPROVED'
    ORDER BY "approvedAt" DESC,id DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'notice unavailable' USING ERRCODE='23514'; END IF;
  INSERT INTO "ConsentNoticePresentation" (id,"userId","noticeId","sessionId","presentedAt")
    VALUES (v_id,v_actor,v_notice.id,v_session,clock_timestamp());
  RETURN QUERY SELECT v_id,v_notice.version::text,v_notice."contentHash"::text,v_notice.content;
END;
$$;

CREATE FUNCTION orvok_radar_grant(p_session_hash text,p_acceptance uuid,p_presentation uuid,p_scope "VisibilityScope",
  p_expected_version text,p_expected_hash text)
RETURNS TABLE(grant_id uuid,consent_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_id uuid := gen_random_uuid(); v_notice_version text; v_notice_hash text;
  v_accept_time timestamptz; v_present_time timestamptz; v_version integer;
BEGIN
  v_actor := orvok_radar_actor(p_session_hash);
  IF p_scope NOT IN ('PRIVATE','SHARED') THEN
    RAISE EXCEPTION 'invalid radar consent scope' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM "User" WHERE id=v_actor FOR UPDATE;
  SELECT "acceptedAt" INTO v_accept_time FROM "RadarInvitationAcceptance"
    WHERE id=p_acceptance AND "targetId"=v_actor;
  IF v_accept_time IS NULL THEN RAISE EXCEPTION 'acceptance unavailable' USING ERRCODE='23514'; END IF;
  SELECT n.version,n."contentHash",p."presentedAt" INTO v_notice_version,v_notice_hash,v_present_time
    FROM "ConsentNoticePresentation" p
    JOIN "ConsentNotice" n ON n.id=p."noticeId"
    JOIN "AuthSession" s ON s.id=p."sessionId"
    WHERE p.id=p_presentation AND p."userId"=v_actor AND s."tokenHash"=p_session_hash
      AND n.purpose='BE_PREDICTED' AND n.status='APPROVED';
  IF v_notice_version IS NULL OR v_notice_version<>p_expected_version OR v_notice_hash<>p_expected_hash OR
    v_present_time<=v_accept_time OR v_present_time>=clock_timestamp() THEN
    RAISE EXCEPTION 'approved notice presentation required' USING ERRCODE='23514';
  END IF;
  SELECT COALESCE(MAX("consentVersion"),0)+1 INTO v_version FROM "ConsentGrant"
    WHERE "subjectId"=v_actor AND purpose='BE_PREDICTED';
  INSERT INTO "ConsentGrant"
    (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","consentVersion","invitationAcceptanceId","noticePresentationId","grantedAt")
    VALUES (v_id,v_actor,'BE_PREDICTED',p_scope,v_notice_version,v_notice_hash,v_version,p_acceptance,p_presentation,clock_timestamp());
  INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES (gen_random_uuid(),v_actor,'RADAR_CONSENT_GRANTED','ConsentGrant',v_id,clock_timestamp());
  RETURN QUERY SELECT v_id,v_version;
END;
$$;

CREATE FUNCTION orvok_radar_revoke(p_session_hash text,p_grant uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_id uuid := gen_random_uuid(); v_granted timestamptz;
BEGIN
  v_actor := orvok_radar_actor(p_session_hash);
  SELECT "grantedAt" INTO v_granted FROM "ConsentGrant"
    WHERE id=p_grant AND "subjectId"=v_actor AND purpose='BE_PREDICTED' FOR UPDATE;
  IF v_granted IS NULL OR v_granted>=clock_timestamp() THEN
    RAISE EXCEPTION 'grant unavailable' USING ERRCODE='23514';
  END IF;
  INSERT INTO "ConsentRevocation" (id,"grantId","subjectId","revokedAt")
    VALUES (v_id,p_grant,v_actor,clock_timestamp());
  INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES (gen_random_uuid(),v_actor,'RADAR_CONSENT_REVOKED','ConsentGrant',p_grant,clock_timestamp());
  RETURN v_id;
END;
$$;

CREATE FUNCTION orvok_radar_grant_self(p_session_hash text,p_presentation uuid,p_expected_version text,p_expected_hash text)
RETURNS TABLE(grant_id uuid,consent_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_id uuid := gen_random_uuid(); v_notice_version text; v_notice_hash text;
  v_present_time timestamptz; v_version integer;
BEGIN
  v_actor := orvok_radar_actor(p_session_hash);
  PERFORM 1 FROM "User" WHERE id=v_actor FOR UPDATE;
  SELECT n.version,n."contentHash",p."presentedAt" INTO v_notice_version,v_notice_hash,v_present_time
    FROM "ConsentNoticePresentation" p
    JOIN "ConsentNotice" n ON n.id=p."noticeId"
    JOIN "AuthSession" s ON s.id=p."sessionId"
    WHERE p.id=p_presentation AND p."userId"=v_actor AND s."tokenHash"=p_session_hash
      AND n.purpose='SELF_ANSWER' AND n.status='APPROVED';
  IF v_notice_version IS NULL OR v_notice_version<>p_expected_version OR v_notice_hash<>p_expected_hash OR
    v_present_time>=clock_timestamp() THEN
    RAISE EXCEPTION 'approved self-answer notice presentation required' USING ERRCODE='23514';
  END IF;
  SELECT COALESCE(MAX("consentVersion"),0)+1 INTO v_version FROM "ConsentGrant"
    WHERE "subjectId"=v_actor AND purpose='SELF_ANSWER';
  INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash",
    "consentVersion","noticePresentationId","grantedAt")
    VALUES (v_id,v_actor,'SELF_ANSWER','PRIVATE',v_notice_version,v_notice_hash,v_version,p_presentation,clock_timestamp());
  INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES (gen_random_uuid(),v_actor,'SELF_ANSWER_CONSENT_GRANTED','ConsentGrant',v_id,clock_timestamp());
  RETURN QUERY SELECT v_id,v_version;
END;
$$;

CREATE FUNCTION orvok_radar_revoke_self(p_session_hash text,p_grant uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_id uuid := gen_random_uuid(); v_granted timestamptz;
BEGIN
  v_actor := orvok_radar_actor(p_session_hash);
  SELECT "grantedAt" INTO v_granted FROM "ConsentGrant"
    WHERE id=p_grant AND "subjectId"=v_actor AND purpose='SELF_ANSWER' FOR UPDATE;
  IF v_granted IS NULL OR v_granted>=clock_timestamp() THEN
    RAISE EXCEPTION 'self-answer grant unavailable' USING ERRCODE='23514';
  END IF;
  INSERT INTO "ConsentRevocation" (id,"grantId","subjectId","revokedAt")
    VALUES (v_id,p_grant,v_actor,clock_timestamp());
  INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES (gen_random_uuid(),v_actor,'SELF_ANSWER_CONSENT_REVOKED','ConsentGrant',p_grant,clock_timestamp());
  RETURN v_id;
END;
$$;

CREATE FUNCTION orvok_radar_answer(p_session_hash text,p_question uuid,p_option uuid,p_grant uuid,p_supersedes uuid)
RETURNS TABLE(answer_id uuid,answer_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_id uuid := gen_random_uuid(); v_granted timestamptz;
  v_previous uuid; v_version integer; v_now timestamptz; v_hash text;
BEGIN
  v_actor := orvok_radar_actor(p_session_hash);
  PERFORM 1 FROM "User" WHERE id=v_actor FOR UPDATE;
  SELECT "grantedAt" INTO v_granted FROM "ConsentGrant"
    WHERE id=p_grant AND "subjectId"=v_actor AND purpose='SELF_ANSWER' FOR UPDATE;
  IF v_granted IS NULL OR EXISTS (SELECT 1 FROM "ConsentRevocation" WHERE "grantId"=p_grant) THEN
    RAISE EXCEPTION 'active self-answer consent required' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "AnswerOption" ao JOIN "QuestionVersion" qv ON qv.id=ao."questionVersionId"
    JOIN "Question" q ON q.id=qv."questionId"
    WHERE ao.id=p_option AND ao."questionVersionId"=p_question AND q.domain='RADAR'
  ) THEN RAISE EXCEPTION 'radar option unavailable' USING ERRCODE='23514'; END IF;
  SELECT id,version INTO v_previous,v_version FROM "AnswerVersion"
    WHERE "subjectId"=v_actor AND "questionVersionId"=p_question
    ORDER BY version DESC LIMIT 1 FOR UPDATE;
  IF v_previous IS DISTINCT FROM p_supersedes THEN
    RAISE EXCEPTION 'answer supersession conflict' USING ERRCODE='23514';
  END IF;
  v_version := COALESCE(v_version,0)+1;
  v_now := clock_timestamp();
  IF v_granted>=v_now THEN RAISE EXCEPTION 'answer before consent' USING ERRCODE='23514'; END IF;
  v_hash := encode(digest(convert_to(jsonb_build_object('id',v_id,'actor',v_actor,'question',p_question,
    'option',p_option,'grant',p_grant,'version',v_version,'supersedes',p_supersedes,'at',v_now)::text,'UTF8'),'sha256'),'hex');
  INSERT INTO "AnswerVersion" (id,"subjectId","questionVersionId","optionId","consentGrantId",version,"supersedesId","answeredAt","snapshotHash")
    VALUES (v_id,v_actor,p_question,p_option,p_grant,v_version,p_supersedes,v_now,v_hash);
  INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES (gen_random_uuid(),v_actor,'RADAR_SELF_ANSWER_CREATED','AnswerVersion',v_id,clock_timestamp());
  RETURN QUERY SELECT v_id,v_version;
END;
$$;

CREATE FUNCTION orvok_radar_predict(p_session_hash text,p_target uuid,p_question uuid,p_self_answer uuid,
  p_grant uuid,p_vector jsonb,p_supersedes uuid)
RETURNS TABLE(snapshot_id uuid,consent_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid; v_id uuid := gen_random_uuid(); v_grant "ConsentGrant";
  v_invitation "RadarInvitation"; v_acceptance "RadarInvitationAcceptance";
  v_answer uuid; v_answered timestamptz; v_self_answered timestamptz;
  v_now timestamptz; v_hash text; v_count integer; v_total numeric; v_previous uuid;
BEGIN
  v_actor := orvok_radar_actor(p_session_hash);
  SELECT * INTO v_grant FROM "ConsentGrant" WHERE id=p_grant AND "subjectId"=p_target
    AND purpose='BE_PREDICTED' FOR UPDATE;
  IF NOT FOUND OR v_grant."invitationAcceptanceId" IS NULL OR
    EXISTS (SELECT 1 FROM "ConsentRevocation" WHERE "grantId"=p_grant) OR
    NOT EXISTS (SELECT 1 FROM "User" WHERE id=p_target AND status='ACTIVE') THEN
    RAISE EXCEPTION 'active radar consent required' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_acceptance FROM "RadarInvitationAcceptance" WHERE id=v_grant."invitationAcceptanceId";
  SELECT * INTO v_invitation FROM "RadarInvitation" WHERE id=v_acceptance."invitationId";
  IF v_invitation."predictorId" IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'consent does not cover predictor' USING ERRCODE='23514';
  END IF;
  SELECT a.id,a."answeredAt" INTO v_answer,v_answered FROM "AnswerVersion" a
    JOIN "QuestionVersion" qv ON qv.id=a."questionVersionId"
    JOIN "Question" q ON q.id=qv."questionId"
    WHERE a."subjectId"=p_target AND a."questionVersionId"=p_question AND q.domain='RADAR'
    ORDER BY a.version DESC LIMIT 1;
  SELECT "answeredAt" INTO v_self_answered FROM "AnswerVersion"
    WHERE id=p_self_answer AND "subjectId"=v_actor AND "questionVersionId"=p_question;
  v_now := clock_timestamp();
  IF v_answer IS NULL OR v_self_answered IS NULL OR
    NOT (v_invitation."invitedAt"<v_acceptance."acceptedAt" AND
      v_acceptance."acceptedAt"<v_grant."grantedAt" AND
      v_grant."grantedAt"<v_answered AND v_answered<v_now AND v_self_answered<v_now) THEN
    RAISE EXCEPTION 'radar temporal order invalid' USING ERRCODE='23514';
  END IF;
  SELECT COUNT(*)::integer INTO v_count FROM "AnswerOption" WHERE "questionVersionId"=p_question;
  IF jsonb_typeof(p_vector) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid probability vector' USING ERRCODE='23514';
  END IF;
  IF jsonb_array_length(p_vector)<>v_count OR v_count<2 OR
    EXISTS (SELECT 1 FROM jsonb_array_elements(p_vector) AS e(value) WHERE jsonb_typeof(e.value) <> 'number') THEN
    RAISE EXCEPTION 'invalid probability vector' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_vector) AS e(value) WHERE e.value::numeric<0 OR e.value::numeric>1) THEN
    RAISE EXCEPTION 'invalid probability vector' USING ERRCODE='23514';
  END IF;
  SELECT SUM(e.value::numeric) INTO v_total FROM jsonb_array_elements(p_vector) AS e(value);
  IF abs(v_total-1)>0.000000001 THEN RAISE EXCEPTION 'invalid probability total' USING ERRCODE='23514'; END IF;
  IF p_supersedes IS NOT NULL THEN
    SELECT id INTO v_previous FROM "SocialPredictionSnapshot"
      WHERE id=p_supersedes AND "predictorId"=v_actor AND "targetId"=p_target AND "questionVersionId"=p_question;
    IF v_previous IS NULL THEN RAISE EXCEPTION 'invalid snapshot supersession' USING ERRCODE='23514'; END IF;
  END IF;
  v_hash := encode(digest(convert_to(jsonb_build_object('id',v_id,'predictor',v_actor,'target',p_target,
    'question',p_question,'answer',v_answer,'selfAnswer',p_self_answer,'grant',p_grant,
    'consentVersion',v_grant."consentVersion",'vector',p_vector,'supersedes',p_supersedes,'at',v_now)::text,'UTF8'),'sha256'),'hex');
  INSERT INTO "SocialPredictionSnapshot" (id,"predictorId","targetId","questionVersionId","answerVersionId",
    "selfAnswerVersionId","targetConsentGrantId","targetConsentVersion","probabilityVector","supersedesId","predictedAt","snapshotHash")
    VALUES (v_id,v_actor,p_target,p_question,v_answer,p_self_answer,p_grant,v_grant."consentVersion",p_vector,p_supersedes,v_now,v_hash);
  INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES (gen_random_uuid(),v_actor,'RADAR_PREDICTION_CREATED','SocialPredictionSnapshot',v_id,clock_timestamp());
  RETURN QUERY SELECT v_id,v_grant."consentVersion";
END;
$$;

CREATE FUNCTION orvok_radar_audit_blocked(p_session_hash text,p_action text,p_object_type text,p_object_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := orvok_radar_actor(p_session_hash);
  IF p_action NOT IN ('RADAR_INVITE','RADAR_ACCEPT','RADAR_CONSENT_GRANT','RADAR_CONSENT_REVOKE',
    'RADAR_PREDICTION','RADAR_SELF_ANSWER','NOTICE_PRESENTATION') OR
    p_object_type NOT IN ('RadarInvitation','ConsentGrant','SocialPredictionSnapshot','AnswerVersion','ConsentNoticePresentation') OR
    p_reason !~ '^[A-Z_]{1,60}$' THEN
    RAISE EXCEPTION 'invalid blocked action' USING ERRCODE='23514';
  END IF;
  INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","contextHash","occurredAt")
    VALUES (gen_random_uuid(),v_actor,p_action||'_BLOCKED',p_object_type,p_object_id,
      encode(digest(convert_to(p_reason,'UTF8'),'sha256'),'hex'),clock_timestamp());
END;
$$;

REVOKE ALL ON FUNCTION orvok_radar_actor(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION orvok_radar_invite(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION orvok_radar_accept(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION orvok_radar_present_notice(text,"ConsentPurpose") FROM PUBLIC;
REVOKE ALL ON FUNCTION orvok_radar_grant(text,uuid,uuid,"VisibilityScope",text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION orvok_radar_revoke(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION orvok_radar_grant_self(text,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION orvok_radar_revoke_self(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION orvok_radar_answer(text,uuid,uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION orvok_radar_predict(text,uuid,uuid,uuid,uuid,jsonb,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION orvok_radar_audit_blocked(text,text,text,uuid,text) FROM PUBLIC;

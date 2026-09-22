-- A historical SELF_ANSWER grant without a recorded notice presentation
-- remains preserved for audit, but cannot authorize a new answer/snapshot.
CREATE FUNCTION orvok_answer_notice_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_grant "ConsentGrant";
BEGIN
  SELECT * INTO v_grant FROM "ConsentGrant"
    WHERE id=NEW."consentGrantId" AND "subjectId"=NEW."subjectId" FOR UPDATE;
  IF NOT FOUND OR v_grant.purpose<>'SELF_ANSWER' OR v_grant."noticePresentationId" IS NULL OR
    v_grant."grantedAt">=NEW."answeredAt" OR
    EXISTS (SELECT 1 FROM "ConsentRevocation" WHERE "grantId"=v_grant.id) THEN
    RAISE EXCEPTION 'active presented self-answer consent required' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "AnswerVersion_notice_guard" BEFORE INSERT ON "AnswerVersion"
  FOR EACH ROW EXECUTE FUNCTION orvok_answer_notice_guard();

CREATE FUNCTION orvok_snapshot_answer_notice_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_target_grant uuid; v_self_grant uuid; v_expected integer;
BEGIN
  SELECT "consentGrantId" INTO v_target_grant FROM "AnswerVersion" WHERE id=NEW."answerVersionId";
  SELECT "consentGrantId" INTO v_self_grant FROM "AnswerVersion" WHERE id=NEW."selfAnswerVersionId";
  v_expected := CASE WHEN v_target_grant=v_self_grant THEN 1 ELSE 2 END;
  PERFORM 1 FROM "ConsentGrant" g
    WHERE g.id IN (v_target_grant,v_self_grant) AND g.purpose='SELF_ANSWER'
      AND g."noticePresentationId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "ConsentRevocation" r WHERE r."grantId"=g.id)
    ORDER BY g.id FOR UPDATE;
  IF v_target_grant IS NULL OR v_self_grant IS NULL OR
    (SELECT COUNT(*) FROM "ConsentGrant" g WHERE g.id IN (v_target_grant,v_self_grant)
       AND g.purpose='SELF_ANSWER' AND g."noticePresentationId" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "ConsentRevocation" r WHERE r."grantId"=g.id)) <> v_expected THEN
    RAISE EXCEPTION 'presented consent required for both radar answers' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SocialPredictionSnapshot_answer_notice_guard" BEFORE INSERT ON "SocialPredictionSnapshot"
  FOR EACH ROW EXECUTE FUNCTION orvok_snapshot_answer_notice_guard();

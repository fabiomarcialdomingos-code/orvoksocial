CREATE OR REPLACE FUNCTION "radar_snapshot_guard"() RETURNS trigger AS $$
DECLARE grant_row "ConsentGrant";
DECLARE acceptance_row "RadarInvitationAcceptance";
DECLARE invitation_row "RadarInvitation";
DECLARE answer_time TIMESTAMPTZ;
DECLARE self_time TIMESTAMPTZ;
DECLARE answer_grant UUID;
DECLARE self_grant UUID;
BEGIN
  SELECT * INTO grant_row FROM "ConsentGrant" WHERE id=NEW."targetConsentGrantId" AND "subjectId"=NEW."targetId" AND "consentVersion"=NEW."targetConsentVersion" FOR UPDATE;
  IF NOT FOUND OR grant_row.purpose <> 'BE_PREDICTED' OR grant_row."invitationAcceptanceId" IS NULL THEN
    RAISE EXCEPTION 'active radar consent required' USING ERRCODE='23514';
  END IF;
  SELECT * INTO acceptance_row FROM "RadarInvitationAcceptance" WHERE id=grant_row."invitationAcceptanceId";
  SELECT * INTO invitation_row FROM "RadarInvitation" WHERE id=acceptance_row."invitationId";
  SELECT "answeredAt","consentGrantId" INTO answer_time,answer_grant FROM "AnswerVersion" WHERE id=NEW."answerVersionId" AND "subjectId"=NEW."targetId" AND "questionVersionId"=NEW."questionVersionId";
  SELECT "answeredAt","consentGrantId" INTO self_time,self_grant FROM "AnswerVersion" WHERE id=NEW."selfAnswerVersionId" AND "subjectId"=NEW."predictorId" AND "questionVersionId"=NEW."questionVersionId";
  -- Lock both answer grants. A concurrent revocation cannot commit between check and insert.
  PERFORM 1 FROM "ConsentGrant" WHERE id IN (answer_grant,self_grant) AND purpose='SELF_ANSWER' ORDER BY id FOR UPDATE;
  IF invitation_row."predictorId" <> NEW."predictorId" OR
     NOT (invitation_row."invitedAt" < acceptance_row."acceptedAt" AND acceptance_row."acceptedAt" < grant_row."grantedAt" AND grant_row."grantedAt" < answer_time AND answer_time < NEW."predictedAt") OR
     self_time IS NULL OR self_time >= NEW."predictedAt" OR NEW."predictedAt" > clock_timestamp() OR
     EXISTS (SELECT 1 FROM "ConsentRevocation" WHERE "grantId" IN (grant_row.id,answer_grant,self_grant)) OR
     (SELECT count(*) FROM "ConsentGrant" WHERE id IN (answer_grant,self_grant) AND purpose='SELF_ANSWER') <> (CASE WHEN answer_grant=self_grant THEN 1 ELSE 2 END) THEN
    RAISE EXCEPTION 'radar prediction temporal or consent invariant violated' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

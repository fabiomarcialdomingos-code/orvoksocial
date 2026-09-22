CREATE TABLE "RadarInvitation" (
  "id" UUID PRIMARY KEY,
  "predictorId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "targetId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "invitedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RadarInvitation_distinct_people" CHECK ("predictorId" <> "targetId"),
  CONSTRAINT "RadarInvitation_id_targetId_key" UNIQUE ("id", "targetId")
);
CREATE TABLE "RadarInvitationAcceptance" (
  "id" UUID PRIMARY KEY,
  "invitationId" UUID NOT NULL UNIQUE,
  "targetId" UUID NOT NULL,
  "acceptedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RadarInvitationAcceptance_id_targetId_key" UNIQUE ("id", "targetId"),
  CONSTRAINT "RadarInvitationAcceptance_invitationId_targetId_key" UNIQUE ("invitationId", "targetId"),
  CONSTRAINT "RadarInvitationAcceptance_invitation_target_fkey" FOREIGN KEY ("invitationId", "targetId") REFERENCES "RadarInvitation"("id", "targetId") ON DELETE RESTRICT
);
ALTER TABLE "ConsentGrant" ADD COLUMN "consentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ConsentGrant" ADD COLUMN "invitationAcceptanceId" UUID;
-- Existing grants, if any, are historical and must not be silently attached to a new invitation.
ALTER TABLE "ConsentGrant" DISABLE TRIGGER "ConsentGrant_no_update";
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY "subjectId", purpose ORDER BY "grantedAt", id) AS version
  FROM "ConsentGrant"
)
UPDATE "ConsentGrant" g SET "consentVersion" = numbered.version FROM numbered WHERE g.id = numbered.id;
ALTER TABLE "ConsentGrant" ENABLE TRIGGER "ConsentGrant_no_update";
ALTER TABLE "ConsentGrant" ADD CONSTRAINT "ConsentGrant_positive_version" CHECK ("consentVersion" > 0);
ALTER TABLE "ConsentGrant" ADD CONSTRAINT "ConsentGrant_id_subject_version_key" UNIQUE (id,"subjectId","consentVersion");
ALTER TABLE "ConsentGrant" ADD CONSTRAINT "ConsentGrant_subject_purpose_version_key" UNIQUE ("subjectId",purpose,"consentVersion");
ALTER TABLE "ConsentGrant" ADD CONSTRAINT "ConsentGrant_acceptance_subject_fkey" FOREIGN KEY ("invitationAcceptanceId","subjectId") REFERENCES "RadarInvitationAcceptance"(id,"targetId") ON DELETE RESTRICT;
ALTER TABLE "SocialPredictionSnapshot" ADD COLUMN "targetConsentVersion" INTEGER;
ALTER TABLE "SocialPredictionSnapshot" DISABLE TRIGGER "SocialPredictionSnapshot_no_update";
UPDATE "SocialPredictionSnapshot" s SET "targetConsentVersion" = g."consentVersion" FROM "ConsentGrant" g WHERE s."targetConsentGrantId" = g.id;
ALTER TABLE "SocialPredictionSnapshot" ENABLE TRIGGER "SocialPredictionSnapshot_no_update";
ALTER TABLE "SocialPredictionSnapshot" ALTER COLUMN "targetConsentVersion" SET NOT NULL;
ALTER TABLE "SocialPredictionSnapshot" DROP CONSTRAINT "SocialPredictionSnapshot_targetConsentGrantId_targetId_fkey";
ALTER TABLE "SocialPredictionSnapshot" ADD CONSTRAINT "SocialPredictionSnapshot_grant_version_fkey" FOREIGN KEY ("targetConsentGrantId","targetId","targetConsentVersion") REFERENCES "ConsentGrant"(id,"subjectId","consentVersion") ON DELETE RESTRICT;

CREATE FUNCTION "radar_acceptance_guard"() RETURNS trigger AS $$
DECLARE invitation "RadarInvitation";
BEGIN
  SELECT * INTO invitation FROM "RadarInvitation" WHERE id=NEW."invitationId";
  IF NOT FOUND OR invitation."targetId" <> NEW."targetId" OR invitation."invitedAt" >= NEW."acceptedAt" OR NEW."acceptedAt" > clock_timestamp() THEN
    RAISE EXCEPTION 'invalid radar invitation acceptance' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "RadarInvitationAcceptance_guard" BEFORE INSERT ON "RadarInvitationAcceptance" FOR EACH ROW EXECUTE FUNCTION "radar_acceptance_guard"();

CREATE FUNCTION "radar_consent_grant_guard"() RETURNS trigger AS $$
DECLARE accepted_at TIMESTAMPTZ;
BEGIN
  IF NEW.purpose = 'BE_PREDICTED' THEN
    IF NEW."invitationAcceptanceId" IS NULL THEN
      RAISE EXCEPTION 'radar consent requires accepted invitation' USING ERRCODE='23514';
    END IF;
    SELECT "acceptedAt" INTO accepted_at FROM "RadarInvitationAcceptance" WHERE id=NEW."invitationAcceptanceId" AND "targetId"=NEW."subjectId";
    IF accepted_at IS NULL OR accepted_at >= NEW."grantedAt" OR NEW."grantedAt" > clock_timestamp() THEN
      RAISE EXCEPTION 'radar consent order invalid' USING ERRCODE='23514';
    END IF;
  ELSIF NEW."invitationAcceptanceId" IS NOT NULL THEN
    RAISE EXCEPTION 'self answer consent cannot use radar invitation' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ConsentGrant_radar_guard" BEFORE INSERT ON "ConsentGrant" FOR EACH ROW EXECUTE FUNCTION "radar_consent_grant_guard"();

CREATE FUNCTION "radar_revocation_guard"() RETURNS trigger AS $$
DECLARE grant_time TIMESTAMPTZ;
BEGIN
  SELECT "grantedAt" INTO grant_time FROM "ConsentGrant" WHERE id=NEW."grantId" AND "subjectId"=NEW."subjectId";
  IF grant_time IS NULL OR grant_time >= NEW."revokedAt" OR NEW."revokedAt" > clock_timestamp() THEN
    RAISE EXCEPTION 'consent revocation order invalid' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ConsentRevocation_order_guard" BEFORE INSERT ON "ConsentRevocation" FOR EACH ROW EXECUTE FUNCTION "radar_revocation_guard"();

CREATE FUNCTION "radar_snapshot_guard"() RETURNS trigger AS $$
DECLARE grant_row "ConsentGrant";
DECLARE acceptance_row "RadarInvitationAcceptance";
DECLARE invitation_row "RadarInvitation";
DECLARE answer_time TIMESTAMPTZ;
DECLARE self_time TIMESTAMPTZ;
BEGIN
  SELECT * INTO grant_row FROM "ConsentGrant" WHERE id=NEW."targetConsentGrantId" AND "subjectId"=NEW."targetId" AND "consentVersion"=NEW."targetConsentVersion" FOR UPDATE;
  IF NOT FOUND OR grant_row.purpose <> 'BE_PREDICTED' OR grant_row."invitationAcceptanceId" IS NULL THEN
    RAISE EXCEPTION 'active radar consent required' USING ERRCODE='23514';
  END IF;
  SELECT * INTO acceptance_row FROM "RadarInvitationAcceptance" WHERE id=grant_row."invitationAcceptanceId";
  SELECT * INTO invitation_row FROM "RadarInvitation" WHERE id=acceptance_row."invitationId";
  SELECT "answeredAt" INTO answer_time FROM "AnswerVersion" WHERE id=NEW."answerVersionId" AND "subjectId"=NEW."targetId" AND "questionVersionId"=NEW."questionVersionId";
  SELECT "answeredAt" INTO self_time FROM "AnswerVersion" WHERE id=NEW."selfAnswerVersionId" AND "subjectId"=NEW."predictorId" AND "questionVersionId"=NEW."questionVersionId";
  IF invitation_row."predictorId" <> NEW."predictorId" OR
     NOT (invitation_row."invitedAt" < acceptance_row."acceptedAt" AND acceptance_row."acceptedAt" < grant_row."grantedAt" AND grant_row."grantedAt" < answer_time AND answer_time < NEW."predictedAt") OR
     self_time IS NULL OR self_time >= NEW."predictedAt" OR NEW."predictedAt" > clock_timestamp() OR
     EXISTS (SELECT 1 FROM "ConsentRevocation" WHERE "grantId"=grant_row.id) THEN
    RAISE EXCEPTION 'radar prediction temporal or consent invariant violated' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SocialPredictionSnapshot_radar_guard" BEFORE INSERT ON "SocialPredictionSnapshot" FOR EACH ROW EXECUTE FUNCTION "radar_snapshot_guard"();

CREATE TRIGGER "RadarInvitation_no_update" BEFORE UPDATE ON "RadarInvitation" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();
CREATE TRIGGER "RadarInvitationAcceptance_no_update" BEFORE UPDATE ON "RadarInvitationAcceptance" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();

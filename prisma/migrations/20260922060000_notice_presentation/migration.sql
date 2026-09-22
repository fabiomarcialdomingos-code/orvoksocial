CREATE TABLE "ConsentNoticePresentation" (
  id UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "noticeId" UUID NOT NULL REFERENCES "ConsentNotice"(id) ON DELETE RESTRICT,
  "sessionId" UUID NOT NULL REFERENCES "AuthSession"(id) ON DELETE RESTRICT,
  "presentedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentNoticePresentation_id_userId_key" UNIQUE (id,"userId")
);
CREATE INDEX "ConsentNoticePresentation_userId_presentedAt_idx" ON "ConsentNoticePresentation"("userId","presentedAt");
ALTER TABLE "ConsentGrant" ADD COLUMN "noticePresentationId" UUID;
ALTER TABLE "ConsentGrant" ADD CONSTRAINT "ConsentGrant_notice_presentation_subject_fkey"
  FOREIGN KEY ("noticePresentationId","subjectId") REFERENCES "ConsentNoticePresentation"(id,"userId") ON DELETE RESTRICT;

CREATE FUNCTION "notice_presentation_guard"() RETURNS trigger AS $$
DECLARE session_row "AuthSession";
DECLARE notice_status "ConsentNoticeStatus";
BEGIN
  SELECT * INTO session_row FROM "AuthSession" WHERE id=NEW."sessionId";
  SELECT status INTO notice_status FROM "ConsentNotice" WHERE id=NEW."noticeId";
  IF NOT FOUND OR session_row."userId" <> NEW."userId" OR session_row."revokedAt" IS NOT NULL OR session_row."expiresAt" <= clock_timestamp() OR
     notice_status IS DISTINCT FROM 'APPROVED' OR NEW."presentedAt" > clock_timestamp() THEN
    RAISE EXCEPTION 'valid session and approved notice required for presentation' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ConsentNoticePresentation_guard" BEFORE INSERT ON "ConsentNoticePresentation" FOR EACH ROW EXECUTE FUNCTION "notice_presentation_guard"();
CREATE TRIGGER "ConsentNoticePresentation_no_update" BEFORE UPDATE ON "ConsentNoticePresentation" FOR EACH ROW EXECUTE FUNCTION "forbid_structural_history_update"();

CREATE OR REPLACE FUNCTION "consent_approved_guard"() RETURNS trigger AS $$
DECLARE presentation_row "ConsentNoticePresentation";
DECLARE notice_row "ConsentNotice";
DECLARE session_row "AuthSession";
DECLARE acceptance_time TIMESTAMPTZ;
BEGIN
  IF NEW."noticePresentationId" IS NULL THEN
    RAISE EXCEPTION 'notice presentation required' USING ERRCODE='23514';
  END IF;
  SELECT * INTO presentation_row FROM "ConsentNoticePresentation" WHERE id=NEW."noticePresentationId" AND "userId"=NEW."subjectId";
  IF NOT FOUND OR presentation_row."presentedAt" >= NEW."grantedAt" THEN
    RAISE EXCEPTION 'notice must precede grant' USING ERRCODE='23514';
  END IF;
  SELECT * INTO notice_row FROM "ConsentNotice" WHERE id=presentation_row."noticeId";
  SELECT * INTO session_row FROM "AuthSession" WHERE id=presentation_row."sessionId";
  IF NEW.purpose='BE_PREDICTED' THEN
    SELECT "acceptedAt" INTO acceptance_time FROM "RadarInvitationAcceptance" WHERE id=NEW."invitationAcceptanceId" AND "targetId"=NEW."subjectId";
    IF acceptance_time IS NULL OR presentation_row."presentedAt" <= acceptance_time THEN
      RAISE EXCEPTION 'radar notice must follow invitation acceptance' USING ERRCODE='23514';
    END IF;
  END IF;
  IF notice_row.status <> 'APPROVED' OR notice_row.purpose <> NEW.purpose OR notice_row.version <> NEW."noticeVersion" OR notice_row."contentHash" <> NEW."noticeHash" OR
     session_row."userId" <> NEW."subjectId" OR session_row."revokedAt" IS NOT NULL OR session_row."expiresAt" <= NEW."grantedAt" THEN
    RAISE EXCEPTION 'approved notice and active presenting session required' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

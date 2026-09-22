CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION "consent_notice_guard"() RETURNS trigger AS $$
DECLARE approver_role "UserRole";
BEGIN
  IF TG_OP='UPDATE' AND OLD.status='APPROVED' THEN
    RAISE EXCEPTION 'approved notice is immutable' USING ERRCODE='23514';
  END IF;
  IF encode(digest(convert_to(NEW.content,'UTF8'),'sha256'),'hex') <> NEW."contentHash" THEN
    RAISE EXCEPTION 'consent notice hash mismatch' USING ERRCODE='23514';
  END IF;
  IF NEW.status='APPROVED' THEN
    SELECT role INTO approver_role FROM "User" WHERE id=NEW."approvedById" AND status='ACTIVE';
    IF approver_role IS DISTINCT FROM 'ADMIN' THEN
      RAISE EXCEPTION 'notice approval requires active admin' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

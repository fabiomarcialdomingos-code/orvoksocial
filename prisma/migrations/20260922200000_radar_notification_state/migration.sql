-- Inbox events are generated transactionally by Radar facts. The recipient
-- alone may mark their own event read/dismissed; source metadata is immutable.
CREATE POLICY app_notification_update ON "Notification" FOR UPDATE TO orvok_app_runtime
  USING ("recipientId"=orvok_read_actor()) WITH CHECK ("recipientId"=orvok_read_actor());
REVOKE UPDATE ON "Notification" FROM orvok_app_runtime;
GRANT UPDATE (state,"readAt","dismissedAt") ON "Notification" TO orvok_app_runtime;

CREATE FUNCTION orvok_notification_state_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW."recipientId" IS DISTINCT FROM OLD."recipientId" OR
     NEW."eventType" IS DISTINCT FROM OLD."eventType" OR NEW."sourceId" IS DISTINCT FROM OLD."sourceId" OR
     NEW."sourceVersion" IS DISTINCT FROM OLD."sourceVersion" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'notification source immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.state='UNREAD' AND NEW.state='READ' AND NEW."dismissedAt" IS NULL THEN
    NEW."readAt" := clock_timestamp();
    RETURN NEW;
  ELSIF OLD.state IN ('UNREAD','READ') AND NEW.state='DISMISSED' AND NEW."dismissedAt" IS NOT NULL AND
    NEW."readAt" IS NOT DISTINCT FROM OLD."readAt" THEN
    NEW."dismissedAt" := clock_timestamp();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'invalid notification transition' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER notification_state_guard BEFORE UPDATE ON "Notification"
  FOR EACH ROW EXECUTE FUNCTION orvok_notification_state_guard();
REVOKE ALL ON FUNCTION orvok_notification_state_guard() FROM PUBLIC;

CREATE FUNCTION orvok_notification_state_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public."AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt")
    VALUES (gen_random_uuid(),NEW."recipientId",
      CASE WHEN NEW.state='READ' THEN 'RADAR_NOTIFICATION_READ' ELSE 'RADAR_NOTIFICATION_DISMISSED' END,
      'Notification',NEW.id,clock_timestamp());
  RETURN NEW;
END;
$$;
CREATE TRIGGER notification_state_audit AFTER UPDATE ON "Notification"
  FOR EACH ROW EXECUTE FUNCTION orvok_notification_state_audit();
REVOKE ALL ON FUNCTION orvok_notification_state_audit() FROM PUBLIC;

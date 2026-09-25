-- Administrative and social operations write their own audit rows, but the
-- only app insert policy accepted four data-rights actions, so every admin
-- action (question edit/publish, world drafts, publication, resolution, user
-- moderation) and group creation failed with 42501. Rows stay attributable:
-- the actor can only write rows in their own name.
CREATE POLICY app_audit_staff_insert ON "AuditLog" FOR INSERT TO orvok_app_runtime
  WITH CHECK ("actorId" = orvok_read_actor() AND orvok_read_role() IN ('ADMIN', 'MODERATOR'));
CREATE POLICY app_audit_social_insert ON "AuditLog" FOR INSERT TO orvok_app_runtime
  WITH CHECK ("actorId" = orvok_read_actor() AND action IN ('GROUP_CREATED'));

-- World categories are created on demand when an administrator drafts an event.
CREATE POLICY world_category_staff_insert ON "WorldCategory" FOR INSERT TO orvok_app_runtime
  WITH CHECK (orvok_read_role() IN ('ADMIN', 'MODERATOR'));
CREATE POLICY world_category_staff_update ON "WorldCategory" FOR UPDATE TO orvok_app_runtime
  USING (orvok_read_role() IN ('ADMIN', 'MODERATOR'))
  WITH CHECK (orvok_read_role() IN ('ADMIN', 'MODERATOR'));

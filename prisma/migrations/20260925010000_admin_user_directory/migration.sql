-- The Command Center lists and suspends accounts. Until now the app role could
-- only see its own "User" row, so the directory showed one line and suspension
-- updated nothing. Administrators and moderators may read; only administrators
-- may change the status column (column privilege granted by provisioning).
CREATE POLICY admin_user_select ON "User" FOR SELECT TO orvok_app_runtime
  USING (orvok_read_role() IN ('ADMIN', 'MODERATOR'));
CREATE POLICY admin_user_status_update ON "User" FOR UPDATE TO orvok_app_runtime
  USING (orvok_read_role() = 'ADMIN' AND id <> orvok_read_actor())
  WITH CHECK (orvok_read_role() = 'ADMIN' AND id <> orvok_read_actor());

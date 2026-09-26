-- world.createEvent, publishEvent, resolve and userAction all write to
-- AdminAction before touching their target tables. The RLS policies
-- (admin_action_access, admin_action_insert) were created for
-- orvok_app_runtime, but the base table grant was never issued, so every
-- admin write failed with 42501 before the policy was ever evaluated.
GRANT SELECT, INSERT ON "AdminAction" TO orvok_app_runtime;

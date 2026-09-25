-- RLS policies on Social and World tables call these helpers. Policy
-- expressions run with the caller's privileges, so the app role needs EXECUTE
-- or every read of those tables fails with 42501 (surfaced as 403).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orvok_app_runtime') THEN
    GRANT EXECUTE ON FUNCTION orvok_current_actor(), orvok_social_member(uuid,uuid) TO orvok_app_runtime;
  END IF;
END $$;

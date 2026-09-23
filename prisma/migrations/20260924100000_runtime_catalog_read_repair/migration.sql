-- Reapply the read privileges required by Radar and the admin catalog.
-- This is idempotent and safe to run after runtime-role provisioning.
GRANT SELECT ON "Question", "QuestionVersion", "AnswerOption" TO orvok_app_runtime;
GRANT EXECUTE ON FUNCTION orvok_catalog_version_enabled(uuid) TO orvok_app_runtime;
GRANT EXECUTE ON FUNCTION orvok_catalog_test_configured() TO orvok_app_runtime;

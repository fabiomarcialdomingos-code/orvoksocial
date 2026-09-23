DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orvok_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON "MathDomainEvent" TO orvok_app_runtime;
    GRANT INSERT ON "MathProcessingJob" TO orvok_app_runtime;
  END IF;
END $$;

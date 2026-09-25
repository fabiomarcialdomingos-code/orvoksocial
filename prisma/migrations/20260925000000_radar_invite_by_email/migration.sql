-- Resolve a Radar invitation target by verified e-mail without exposing the
-- identity table to the application role. Returns NULL for unknown, inactive,
-- unverified or self addresses so the caller can answer uniformly.
CREATE OR REPLACE FUNCTION orvok_radar_resolve_target(p_session_hash text, p_email text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_actor uuid; v_target uuid;
BEGIN
  v_actor := public.orvok_radar_actor(p_session_hash);
  IF p_email IS NULL OR length(p_email) > 320 THEN RETURN NULL; END IF;
  SELECT ai."userId" INTO v_target
    FROM public."AuthIdentity" ai JOIN public."User" u ON u.id = ai."userId"
    WHERE ai.email = lower(btrim(p_email)) AND ai."verifiedAt" IS NOT NULL
      AND u.status = 'ACTIVE' AND ai."userId" <> v_actor;
  RETURN v_target;
END;
$$;
REVOKE ALL ON FUNCTION orvok_radar_resolve_target(text, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orvok_app_runtime') THEN
    GRANT EXECUTE ON FUNCTION orvok_radar_resolve_target(text, text) TO orvok_app_runtime;
  END IF;
END $$;

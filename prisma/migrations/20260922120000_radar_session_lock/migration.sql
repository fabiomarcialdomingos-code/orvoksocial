-- Serialize each Radar RPC with session revocation, account suspension, and
-- identity changes. A revocation may win first (RPC rejects), or the RPC may
-- commit first; it cannot insert after a committed revocation.
CREATE OR REPLACE FUNCTION orvok_radar_actor(p_session_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid;
BEGIN
  IF p_session_hash IS NULL OR p_session_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid session' USING ERRCODE='28000';
  END IF;
  SELECT s."userId" INTO v_actor
  FROM "AuthSession" s
  JOIN "User" u ON u.id=s."userId"
  JOIN "AuthIdentity" ai ON ai."userId"=u.id
  WHERE s."tokenHash"=p_session_hash AND s."revokedAt" IS NULL
    AND s."expiresAt">clock_timestamp() AND u.status='ACTIVE'
    AND ai."verifiedAt" IS NOT NULL
  FOR SHARE OF s,u,ai;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'invalid session' USING ERRCODE='28000';
  END IF;
  RETURN v_actor;
END;
$$;
REVOKE ALL ON FUNCTION orvok_radar_actor(text) FROM PUBLIC;

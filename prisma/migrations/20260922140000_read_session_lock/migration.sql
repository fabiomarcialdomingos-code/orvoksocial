-- A scoped read/export transaction locks the verified session until it ends,
-- making session revocation and sensitive reads linearly ordered.
CREATE FUNCTION orvok_bind_read_actor(p_hash text) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_actor uuid;
BEGIN
  SELECT s."userId" INTO v_actor FROM public."AuthSession" s
  JOIN public."User" u ON u.id=s."userId"
  JOIN public."AuthIdentity" ai ON ai."userId"=u.id
  WHERE s."tokenHash"=p_hash AND s."revokedAt" IS NULL
    AND s."expiresAt">clock_timestamp() AND u.status='ACTIVE'
    AND ai."verifiedAt" IS NOT NULL
  FOR SHARE OF s,u,ai;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'session unavailable' USING ERRCODE='28000';
  END IF;
  PERFORM set_config('orvok.session_hash',p_hash,true);
  RETURN v_actor;
END $$;
REVOKE ALL ON FUNCTION orvok_bind_read_actor(text) FROM PUBLIC;

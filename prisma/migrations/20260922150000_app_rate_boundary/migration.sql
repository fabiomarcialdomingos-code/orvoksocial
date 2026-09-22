-- The application role can charge only its verified actor's abuse bucket.
-- Raw AuthRateLimit DML remains private to the authentication role.
CREATE FUNCTION orvok_app_rate_attempt(p_route text) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_actor uuid; v_key text; v_attempts integer;
BEGIN
  v_actor := public.orvok_read_actor();
  IF v_actor IS NULL OR length(p_route)<1 OR length(p_route)>160 THEN
    RAISE EXCEPTION 'session or route unavailable' USING ERRCODE='28000';
  END IF;
  v_key := encode(public.digest('API-RATE-01:'||v_actor::text||':'||p_route,'sha256'),'hex');
  INSERT INTO public."AuthRateLimit" ("keyHash",attempts,"resetsAt")
    VALUES (v_key,1,clock_timestamp()+interval '1 minute')
    ON CONFLICT ("keyHash") DO UPDATE SET
      attempts=CASE WHEN public."AuthRateLimit"."resetsAt"<=clock_timestamp()
        THEN 1 ELSE public."AuthRateLimit".attempts+1 END,
      "resetsAt"=CASE WHEN public."AuthRateLimit"."resetsAt"<=clock_timestamp()
        THEN clock_timestamp()+interval '1 minute' ELSE public."AuthRateLimit"."resetsAt" END
    RETURNING attempts INTO v_attempts;
  RETURN v_attempts;
END $$;
REVOKE ALL ON FUNCTION orvok_app_rate_attempt(text) FROM PUBLIC;

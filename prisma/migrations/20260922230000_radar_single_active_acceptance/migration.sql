-- A second active grant for one accepted invitation would survive a revocation
-- of the first grant and continue to expose the target. Serialize issuance on
-- the subject row, as the Radar RPC already does, and preserve revoked history.
CREATE FUNCTION orvok_radar_single_active_acceptance_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.purpose <> 'BE_PREDICTED' THEN RETURN NEW; END IF;
  PERFORM 1 FROM public."User" WHERE id=NEW."subjectId" FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public."ConsentGrant" g
    WHERE g."invitationAcceptanceId"=NEW."invitationAcceptanceId"
      AND g.purpose='BE_PREDICTED'
      AND NOT EXISTS (SELECT 1 FROM public."ConsentRevocation" r WHERE r."grantId"=g.id)
  ) THEN
    RAISE EXCEPTION 'active consent already exists for invitation acceptance' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "AAC_radar_single_active_acceptance_guard" BEFORE INSERT ON "ConsentGrant"
  FOR EACH ROW EXECUTE FUNCTION orvok_radar_single_active_acceptance_guard();
REVOKE ALL ON FUNCTION orvok_radar_single_active_acceptance_guard() FROM PUBLIC;

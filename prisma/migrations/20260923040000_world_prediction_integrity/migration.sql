CREATE OR REPLACE FUNCTION orvok_world_prediction_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE e public."WorldEvent"; v_event uuid;
BEGIN
  SELECT * INTO e FROM public."WorldEvent" WHERE id=NEW."eventId" FOR UPDATE;
  SELECT "eventId" INTO v_event FROM public."WorldOpportunity" WHERE id=NEW."opportunityId";
  IF v_event IS NULL OR v_event<>NEW."eventId" THEN
    RAISE EXCEPTION 'opportunity does not belong to event' USING ERRCODE='23514';
  END IF;
  IF e.status<>'PUBLISHED' OR clock_timestamp() < e."opensAt" OR clock_timestamp() >= e."closesAt" - interval '10 minutes' THEN
    RAISE EXCEPTION 'world event is not accepting predictions' USING ERRCODE='23514';
  END IF;
  IF NEW."confirmedAt" < NEW."predictedAt" THEN
    RAISE EXCEPTION 'confirmation must follow prediction' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

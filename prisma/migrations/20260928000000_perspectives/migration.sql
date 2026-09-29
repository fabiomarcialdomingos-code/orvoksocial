-- Additive: historical Radar consent and snapshots are preserved.
CREATE TABLE "PerspectivePreferences" (
 "userId" uuid PRIMARY KEY REFERENCES "User"(id), interests jsonb NOT NULL DEFAULT '[]',
 age integer CHECK(age BETWEEN 13 AND 120), profession varchar(120) NOT NULL DEFAULT '',
 "showAge" boolean NOT NULL DEFAULT false,"showProfession" boolean NOT NULL DEFAULT false,
 "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(jsonb_typeof(interests)='array')
);
CREATE TABLE "PerspectiveRound" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"ownerId" uuid NOT NULL REFERENCES "User"(id),
 kind varchar(16) NOT NULL CHECK(kind IN ('initial','relationship','daily')),relationship varchar(16) NOT NULL,
 "catalogVersion" varchar(80) NOT NULL,questions jsonb NOT NULL,answers jsonb NOT NULL DEFAULT '{}',skipped jsonb NOT NULL DEFAULT '[]',
 "consentVersion" varchar(80) NOT NULL,"consentText" text NOT NULL,"consentedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
 "sealedAt" timestamptz,"createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(jsonb_typeof(questions)='array' AND jsonb_array_length(questions) BETWEEN 1 AND 12),
 CHECK(jsonb_typeof(answers)='object' AND jsonb_typeof(skipped)='array')
);
CREATE INDEX perspective_round_owner ON "PerspectiveRound"("ownerId","createdAt" DESC);
CREATE UNIQUE INDEX perspective_initial_once ON "PerspectiveRound"("ownerId") WHERE kind='initial';
CREATE TABLE "PerspectiveConnection" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code varchar(32) NOT NULL UNIQUE,
 "ownerId" uuid NOT NULL REFERENCES "User"(id),"guestId" uuid REFERENCES "User"(id),
 kind varchar(8) NOT NULL CHECK(kind IN ('people','world')),relationship varchar(16) NOT NULL,title varchar(240) NOT NULL,
 "roundId" uuid REFERENCES "PerspectiveRound"(id),"eventId" uuid REFERENCES "WorldEvent"(id),
 "ownerPredictionId" uuid REFERENCES "WorldPrediction"(id),"guestPredictionId" uuid REFERENCES "WorldPrediction"(id),
 questions jsonb NOT NULL DEFAULT '[]',answers jsonb NOT NULL,guesses jsonb,"ownWorldChoice" uuid REFERENCES "WorldOpportunity"(id),
 "consentVersion" varchar(80) NOT NULL,"shareNotice" text NOT NULL,"acceptNotice" text,
 "acceptedAt" timestamptz,"completedAt" timestamptz,"revokedAt" timestamptz,
 "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),"expiresAt" timestamptz NOT NULL DEFAULT clock_timestamp()+interval '14 days',
 CHECK("guestId" IS DISTINCT FROM "ownerId"),
 CHECK((kind='people' AND "roundId" IS NOT NULL AND "eventId" IS NULL) OR (kind='world' AND "eventId" IS NOT NULL AND "ownerPredictionId" IS NOT NULL)),
 CHECK("completedAt" IS NULL OR ("acceptedAt" IS NOT NULL AND guesses IS NOT NULL))
);
CREATE INDEX perspective_owner ON "PerspectiveConnection"("ownerId","createdAt" DESC);
CREATE INDEX perspective_guest ON "PerspectiveConnection"("guestId","createdAt" DESC);
CREATE INDEX perspective_event ON "PerspectiveConnection"("eventId") WHERE kind='world';
CREATE TABLE "PerspectiveMessage" (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"connectionId" uuid NOT NULL REFERENCES "PerspectiveConnection"(id),"authorId" uuid NOT NULL REFERENCES "User"(id),body varchar(1200) NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE "PerspectivePreferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerspectiveRound" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerspectiveConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerspectiveMessage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY perspective_preferences_owner ON "PerspectivePreferences" TO orvok_app_runtime USING("userId"=orvok_read_actor()) WITH CHECK("userId"=orvok_read_actor());
CREATE POLICY perspective_round_owner ON "PerspectiveRound" TO orvok_app_runtime USING("ownerId"=orvok_read_actor()) WITH CHECK("ownerId"=orvok_read_actor());
-- No direct grants or policies for connections/messages: secrets leave only through an authorized projection.
CREATE FUNCTION orvok_perspective_view(c public."PerspectiveConnection",actor uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb; active boolean;
BEGIN
 IF actor IS DISTINCT FROM c."ownerId" AND actor IS DISTINCT FROM c."guestId" THEN RAISE EXCEPTION 'not participant' USING ERRCODE='42501'; END IF;
 active:=c."revokedAt" IS NULL AND (c."completedAt" IS NOT NULL OR c."expiresAt">clock_timestamp())
 AND EXISTS(SELECT 1 FROM public."User" WHERE id=c."ownerId" AND status='ACTIVE')
 AND (c."guestId" IS NULL OR EXISTS(SELECT 1 FROM public."User" WHERE id=c."guestId" AND status='ACTIVE'))
 AND NOT EXISTS(SELECT 1 FROM public."SocialBlock" WHERE ("blockerId"=c."ownerId" AND "blockedId"=c."guestId") OR ("blockerId"=c."guestId" AND "blockedId"=c."ownerId"));
 result:=jsonb_build_object('id',c.id,'code',c.code,'kind',c.kind,'title',c.title,'ownerId',c."ownerId",'guestId',c."guestId",'eventId',c."eventId",'isOwner',actor=c."ownerId",'createdAt',c."createdAt",'completedAt',c."completedAt",'expiresAt',c."expiresAt",
 'ownerName',COALESCE((SELECT "displayName" FROM public."UserProfile" WHERE "userId"=c."ownerId"),'Uma pessoa'),'guestName',(SELECT "displayName" FROM public."UserProfile" WHERE "userId"=c."guestId"),
 'state',CASE WHEN c."revokedAt" IS NOT NULL THEN 'revoked' WHEN NOT active THEN 'expired' WHEN c."completedAt" IS NOT NULL THEN 'completed' WHEN c."acceptedAt" IS NOT NULL THEN 'accepted' ELSE 'pending' END);
 IF actor=c."ownerId" THEN result:=result||jsonb_build_object('relationship',c.relationship); END IF;
 IF active THEN
  result:=result||jsonb_build_object('questions',c.questions);
  IF c.kind='world' THEN result:=result||jsonb_build_object('worldOptions',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'label',label) ORDER BY position),'[]') FROM public."WorldOpportunity" WHERE "eventId"=c."eventId")); END IF;
 END IF;
 IF active AND c."completedAt" IS NOT NULL THEN
  result:=result||jsonb_build_object('answers',c.answers,'guesses',c.guesses,'ownWorldChoice',c."ownWorldChoice",
  'resolution',(SELECT jsonb_build_object('state',state,'outcomeOpportunityId',"outcomeOpportunityId",'rationale',rationale) FROM public."WorldResolution" WHERE "eventId"=c."eventId"),
  'messages',(SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m."createdAt"),'[]') FROM (SELECT id,"authorId",body,"createdAt" FROM public."PerspectiveMessage" WHERE "connectionId"=c.id ORDER BY "createdAt" DESC LIMIT 100) m));
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION orvok_perspective_view(public."PerspectiveConnection",uuid) FROM PUBLIC;
CREATE FUNCTION orvok_perspective_connections(action text,data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid;c public."PerspectiveConnection";r public."PerspectiveRound";e public."WorldEvent";p public."WorldPrediction";q jsonb;g jsonb;payload jsonb;result jsonb;code_value text;
BEGIN
 actor:=public.orvok_read_actor();
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public."User" WHERE id=actor AND status='ACTIVE') THEN RAISE EXCEPTION 'session required' USING ERRCODE='28000'; END IF;
 IF action='export' THEN
  SELECT COALESCE(jsonb_agg(v ORDER BY id),'[]') INTO result FROM (SELECT public.orvok_perspective_view(x,actor) v,x.id FROM public."PerspectiveConnection" x WHERE (x."ownerId"=actor OR x."guestId"=actor) AND x.id>(data->>'cursor')::uuid ORDER BY x.id LIMIT 100) i;
  RETURN jsonb_build_object('items',result);
 END IF;
 IF action='list' THEN
  SELECT COALESCE(jsonb_agg(v ORDER BY ts DESC),'[]') INTO result FROM (SELECT public.orvok_perspective_view(x,actor) v,x."createdAt" ts FROM public."PerspectiveConnection" x WHERE x."ownerId"=actor OR x."guestId"=actor ORDER BY x."createdAt" DESC LIMIT 100) i;
  RETURN jsonb_build_object('items',result);
 END IF;
 IF action='create' THEN
  IF data->>'accepted' IS DISTINCT FROM 'true' OR length(COALESCE(data->>'notice',''))=0 THEN RAISE EXCEPTION 'consent required' USING ERRCODE='23514'; END IF;
  IF data ? 'relationship' AND data->>'relationship' NOT IN ('geral','pai','mae','irmao','amigo','crush','parceiro','colega') THEN RAISE EXCEPTION 'invalid relationship' USING ERRCODE='23514'; END IF;
  code_value:=replace(gen_random_uuid()::text,'-','');
  IF data->>'kind'='people' THEN
   SELECT * INTO r FROM public."PerspectiveRound" WHERE id=(data->>'roundId')::uuid AND "ownerId"=actor FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'round unavailable' USING ERRCODE='23514'; END IF;
   FOR q IN SELECT value FROM jsonb_array_elements(r.questions) LOOP
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'options') o WHERE o->>'id'=r.answers->>(q->>'id')) THEN RAISE EXCEPTION 'incomplete round' USING ERRCODE='23514'; END IF;
   END LOOP;
   UPDATE public."PerspectiveRound" SET "sealedAt"=clock_timestamp() WHERE id=r.id AND "sealedAt" IS NULL;
   INSERT INTO public."PerspectiveConnection"(code,"ownerId",kind,relationship,title,"roundId",questions,answers,"consentVersion","shareNotice") VALUES(code_value,actor,'people',COALESCE(data->>'relationship',r.relationship),'Quanto você me conhece?',r.id,r.questions,r.answers,'perspectivas-v1',data->>'notice') RETURNING * INTO c;
  ELSIF data->>'kind'='world' THEN
   SELECT * INTO e FROM public."WorldEvent" WHERE id=(data->>'eventId')::uuid FOR UPDATE;
   IF NOT FOUND OR e.status<>'PUBLISHED' OR e."opensAt">clock_timestamp() OR e."closesAt"-interval '10 minutes'<=clock_timestamp() THEN RAISE EXCEPTION 'event closed' USING ERRCODE='23514'; END IF;
   SELECT * INTO p FROM public."WorldPrediction" WHERE "eventId"=e.id AND "predictorId"=actor ORDER BY "predictedAt" DESC,id DESC LIMIT 1;
   IF NOT FOUND THEN RAISE EXCEPTION 'predict first' USING ERRCODE='23514'; END IF;
   INSERT INTO public."PerspectiveConnection"(code,"ownerId",kind,relationship,title,"eventId","ownerPredictionId",answers,"consentVersion","shareNotice","expiresAt") VALUES(code_value,actor,'world',COALESCE(data->>'relationship','geral'),e.title,e.id,p.id,jsonb_build_object('world',p."opportunityId"),'perspectivas-v1',data->>'notice',LEAST(clock_timestamp()+interval '14 days',e."closesAt"-interval '10 minutes')) RETURNING * INTO c;
  ELSE RAISE EXCEPTION 'invalid kind' USING ERRCODE='23514'; END IF;
  INSERT INTO public."AuditLog"(id,"actorId",action,"objectType","objectId","occurredAt") VALUES(gen_random_uuid(),actor,'PERSPECTIVE_CREATED','PerspectiveConnection',c.id,clock_timestamp());
  RETURN public.orvok_perspective_view(c,actor);
 END IF;
 SELECT * INTO c FROM public."PerspectiveConnection" WHERE code=data->>'code' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'connection unavailable' USING ERRCODE='23514'; END IF;
 IF action='revoke' THEN
  IF actor IS DISTINCT FROM c."ownerId" AND actor IS DISTINCT FROM c."guestId" THEN RAISE EXCEPTION 'not participant' USING ERRCODE='42501'; END IF;
  UPDATE public."PerspectiveConnection" SET "revokedAt"=COALESCE("revokedAt",clock_timestamp()) WHERE id=c.id RETURNING * INTO c;
  INSERT INTO public."AuditLog"(id,"actorId",action,"objectType","objectId","occurredAt") VALUES(gen_random_uuid(),actor,'PERSPECTIVE_REVOKED','PerspectiveConnection',c.id,clock_timestamp());
  RETURN public.orvok_perspective_view(c,actor);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public."User" WHERE id=c."ownerId" AND status='ACTIVE') OR EXISTS(SELECT 1 FROM public."SocialBlock" WHERE ("blockerId"=actor AND "blockedId"=c."ownerId") OR ("blockedId"=actor AND "blockerId"=c."ownerId")) THEN RAISE EXCEPTION 'unavailable' USING ERRCODE='42501'; END IF;
 IF action='read' AND actor IS DISTINCT FROM c."ownerId" AND actor IS DISTINCT FROM c."guestId" THEN
  IF c."guestId" IS NOT NULL OR c."revokedAt" IS NOT NULL OR c."expiresAt"<=clock_timestamp() THEN RAISE EXCEPTION 'connection unavailable' USING ERRCODE='23514'; END IF;
  RETURN jsonb_build_object('code',c.code,'kind',c.kind,'title',c.title,'ownerName',COALESCE((SELECT "displayName" FROM public."UserProfile" WHERE "userId"=c."ownerId"),'Uma pessoa'),'needsAcceptance',true,'state','pending','isOwner',false);
 END IF;
 IF action='read' THEN RETURN public.orvok_perspective_view(c,actor); END IF;
 IF c."revokedAt" IS NOT NULL OR (c."completedAt" IS NULL AND c."expiresAt"<=clock_timestamp()) THEN RAISE EXCEPTION 'connection unavailable' USING ERRCODE='23514'; END IF;
 IF c."guestId" IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM public."User" WHERE id=c."guestId" AND status='ACTIVE') OR EXISTS(SELECT 1 FROM public."SocialBlock" WHERE ("blockerId"=c."ownerId" AND "blockedId"=c."guestId") OR ("blockedId"=c."ownerId" AND "blockerId"=c."guestId"))) THEN RAISE EXCEPTION 'unavailable' USING ERRCODE='42501'; END IF;
 IF action='accept' THEN
  IF actor=c."ownerId" OR (c."guestId" IS NOT NULL AND c."guestId"<>actor) THEN RAISE EXCEPTION 'already accepted' USING ERRCODE='42501'; END IF;
  IF data->>'accepted' IS DISTINCT FROM 'true' OR length(COALESCE(data->>'notice',''))=0 THEN RAISE EXCEPTION 'consent required' USING ERRCODE='23514'; END IF;
  IF c."acceptedAt" IS NULL THEN
   UPDATE public."PerspectiveConnection" SET "guestId"=actor,"acceptedAt"=clock_timestamp(),"acceptNotice"=data->>'notice' WHERE id=c.id RETURNING * INTO c;
   PERFORM public.orvok_social_notify(c."ownerId",'PERSPECTIVE_ACCEPTED',c.id);
  END IF;
 ELSIF action='submit' THEN
  IF actor IS DISTINCT FROM c."guestId" OR c."acceptedAt" IS NULL THEN RAISE EXCEPTION 'not accepted' USING ERRCODE='42501'; END IF;
  IF c."completedAt" IS NOT NULL THEN RETURN public.orvok_perspective_view(c,actor); END IF;
  payload:=data->'guesses';
  IF jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid guesses' USING ERRCODE='23514'; END IF;
  IF c.kind='people' THEN
   PERFORM pg_advisory_xact_lock(hashtext(c."ownerId"::text||':'||actor::text));
   IF (SELECT count(*) FROM jsonb_object_keys(payload))<>jsonb_array_length(c.questions) THEN RAISE EXCEPTION 'incomplete guesses' USING ERRCODE='23514'; END IF;
   FOR q IN SELECT value FROM jsonb_array_elements(c.questions) LOOP
    g:=payload->(q->>'id');
    IF g IS NULL OR jsonb_typeof(g->'confidence') IS DISTINCT FROM 'number' OR (g->>'confidence')::numeric NOT BETWEEN 0.25 AND 1 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'options') o WHERE o->>'id'=g->>'optionId') THEN RAISE EXCEPTION 'invalid guess' USING ERRCODE='23514'; END IF;
    payload:=jsonb_set(payload,ARRAY[q->>'id','previouslyRevealed'],to_jsonb(EXISTS(SELECT 1 FROM public."PerspectiveConnection" x,jsonb_array_elements(x.questions) prior WHERE x."ownerId"=c."ownerId" AND x."guestId"=actor AND x."completedAt" IS NOT NULL AND prior->>'id'=q->>'id' AND prior->>'version'=q->>'version')));
   END LOOP;
  ELSE
   IF (SELECT count(*) FROM jsonb_object_keys(payload))<>1 OR jsonb_typeof(payload->'world'->'confidence') IS DISTINCT FROM 'number' OR (payload->'world'->>'confidence')::numeric NOT BETWEEN 0.25 AND 1 THEN RAISE EXCEPTION 'invalid confidence' USING ERRCODE='23514'; END IF;
   SELECT * INTO e FROM public."WorldEvent" WHERE id=c."eventId" FOR UPDATE;
   IF e.status<>'PUBLISHED' OR e."closesAt"-interval '10 minutes'<=clock_timestamp() THEN RAISE EXCEPTION 'event closed' USING ERRCODE='23514'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public."WorldOpportunity" WHERE "eventId"=e.id AND id=(payload->'world'->>'optionId')::uuid) THEN RAISE EXCEPTION 'invalid option' USING ERRCODE='23514'; END IF;
   SELECT * INTO p FROM public."WorldPrediction" WHERE "eventId"=e.id AND "predictorId"=actor ORDER BY "predictedAt" DESC,id DESC LIMIT 1;
   IF NOT FOUND THEN RAISE EXCEPTION 'predict first' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM public."PerspectiveConnection" WHERE "eventId"=e.id AND "completedAt" IS NOT NULL AND ("ownerId"=actor OR "guestId"=actor)) THEN RAISE EXCEPTION 'already revealed' USING ERRCODE='23514'; END IF;
   UPDATE public."PerspectiveConnection" SET "guestPredictionId"=p.id,"ownWorldChoice"=p."opportunityId" WHERE id=c.id;
  END IF;
  UPDATE public."PerspectiveConnection" SET guesses=payload,"completedAt"=clock_timestamp() WHERE id=c.id RETURNING * INTO c;
  PERFORM public.orvok_social_notify(c."ownerId",'PERSPECTIVE_COMPLETED',c.id);
 ELSIF action='message' THEN
  IF c."completedAt" IS NULL OR (actor IS DISTINCT FROM c."ownerId" AND actor IS DISTINCT FROM c."guestId") THEN RAISE EXCEPTION 'not participant' USING ERRCODE='42501'; END IF;
  IF length(trim(COALESCE(data->>'body',''))) NOT BETWEEN 1 AND 1200 THEN RAISE EXCEPTION 'invalid message' USING ERRCODE='23514'; END IF;
  INSERT INTO public."PerspectiveMessage"("connectionId","authorId",body) VALUES(c.id,actor,trim(data->>'body'));
  PERFORM public.orvok_social_notify(CASE WHEN actor=c."ownerId" THEN c."guestId" ELSE c."ownerId" END,'PERSPECTIVE_MESSAGE',c.id);
 ELSE RAISE EXCEPTION 'invalid action' USING ERRCODE='23514'; END IF;
 RETURN public.orvok_perspective_view(c,actor);
END $$;
REVOKE ALL ON FUNCTION orvok_perspective_connections(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_perspective_connections(text,jsonb) TO orvok_app_runtime;
GRANT SELECT,INSERT,UPDATE ON "PerspectiveRound","PerspectivePreferences" TO orvok_app_runtime;
CREATE FUNCTION orvok_world_independence_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public."WorldEvent" WHERE id=NEW."eventId" FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public."PerspectiveConnection" WHERE "eventId"=NEW."eventId" AND "completedAt" IS NOT NULL AND ("ownerId"=NEW."predictorId" OR "guestId"=NEW."predictorId")) THEN RAISE EXCEPTION 'shared answer already revealed' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION orvok_world_independence_guard() FROM PUBLIC;
CREATE TRIGGER world_independence_guard BEFORE INSERT ON "WorldPrediction" FOR EACH ROW EXECUTE FUNCTION orvok_world_independence_guard();
CREATE FUNCTION orvok_perspective_round_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD."sealedAt" IS NOT NULL THEN RAISE EXCEPTION 'shared round immutable' USING ERRCODE='23514'; END IF;
 IF NEW."ownerId"<>OLD."ownerId" OR NEW.kind<>OLD.kind OR NEW."catalogVersion"<>OLD."catalogVersion" OR NEW."consentVersion"<>OLD."consentVersion" OR NEW."consentText"<>OLD."consentText" OR NEW."consentedAt"<>OLD."consentedAt" THEN RAISE EXCEPTION 'immutable identity' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER perspective_round_guard BEFORE UPDATE ON "PerspectiveRound" FOR EACH ROW EXECUTE FUNCTION orvok_perspective_round_guard();
CREATE FUNCTION orvok_perspective_profile(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('userId',p."userId",'displayName',p."displayName",'avatarUrl',p."avatarUrl",'bio',p.bio,'age',CASE WHEN x."showAge" THEN x.age ELSE NULL END,'profession',CASE WHEN x."showProfession" THEN x.profession ELSE NULL END)
 FROM public."UserProfile" p JOIN public."User" u ON u.id=p."userId" LEFT JOIN public."PerspectivePreferences" x ON x."userId"=p."userId"
 WHERE p."userId"=target AND u.status='ACTIVE' AND public.orvok_read_actor() IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public."SocialBlock" WHERE ("blockerId"=target AND "blockedId"=public.orvok_read_actor()) OR ("blockedId"=target AND "blockerId"=public.orvok_read_actor()))
$$;
REVOKE ALL ON FUNCTION orvok_perspective_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_perspective_profile(uuid) TO orvok_app_runtime;

CREATE TABLE "UserProfile" (
  "userId" uuid PRIMARY KEY REFERENCES "User"(id) ON DELETE RESTRICT,
  "displayName" varchar(120) NOT NULL,
  "avatarUrl" text,
  "bio" varchar(500),
  "updatedAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE "SocialGroup" (
  id uuid PRIMARY KEY,
  "ownerId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  name varchar(160) NOT NULL,
  description varchar(1000),
  state varchar(24) NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE','FROZEN','ARCHIVED')),
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE "SocialGroupMember" (
  "groupId" uuid NOT NULL REFERENCES "SocialGroup"(id) ON DELETE RESTRICT,
  "userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  role varchar(16) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER','MODERATOR','MEMBER')),
  state varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE','REMOVED')),
  "joinedAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY ("groupId","userId")
);
CREATE TABLE "SocialGroupInvitation" (
  id uuid PRIMARY KEY,
  "groupId" uuid NOT NULL REFERENCES "SocialGroup"(id) ON DELETE RESTRICT,
  "inviterId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "inviteeId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  state varchar(16) NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','ACCEPTED','DECLINED','EXPIRED')),
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  "respondedAt" timestamptz(6)
);
CREATE UNIQUE INDEX social_group_invite_pending ON "SocialGroupInvitation" ("groupId","inviteeId") WHERE state='PENDING';
CREATE TABLE "SocialGroupEvent" (
  id uuid PRIMARY KEY,
  "groupId" uuid NOT NULL REFERENCES "SocialGroup"(id) ON DELETE RESTRICT,
  "creatorId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  title varchar(200) NOT NULL,
  description varchar(2000),
  state varchar(24) NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN','FROZEN','RESOLVED_TEST','CANCELLED')),
  "startsAt" timestamptz(6), "endsAt" timestamptz(6),
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  "resolvedAt" timestamptz(6)
);
CREATE TABLE "SocialPost" (
  id uuid PRIMARY KEY,
  "authorId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "groupId" uuid REFERENCES "SocialGroup"(id) ON DELETE RESTRICT,
  "eventId" uuid REFERENCES "SocialGroupEvent"(id) ON DELETE RESTRICT,
  body varchar(5000) NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE "SocialComment" (id uuid PRIMARY KEY,"postId" uuid NOT NULL REFERENCES "SocialPost"(id) ON DELETE RESTRICT,"authorId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,body varchar(2000) NOT NULL,"createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp());
CREATE TABLE "SocialReaction" ("postId" uuid NOT NULL REFERENCES "SocialPost"(id) ON DELETE RESTRICT,"userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,kind varchar(32) NOT NULL,"createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY ("postId","userId",kind));
CREATE TABLE "SocialMessage" (id uuid PRIMARY KEY,"senderId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,"recipientId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,"predictionId" uuid REFERENCES "SocialPredictionSnapshot"(id) ON DELETE RESTRICT,body varchar(2000) NOT NULL,"createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),"readAt" timestamptz(6));
CREATE TABLE "SocialBlock" ("blockerId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,"blockedId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,"createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY ("blockerId","blockedId"),CHECK ("blockerId"<>"blockedId"));
CREATE TABLE "SocialReport" (id uuid PRIMARY KEY,"reporterId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,"targetUserId" uuid REFERENCES "User"(id) ON DELETE RESTRICT,"postId" uuid REFERENCES "SocialPost"(id) ON DELETE RESTRICT,"reason" varchar(500) NOT NULL,state varchar(24) NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN','REVIEWING','RESOLVED','DISMISSED')),"createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),"resolvedAt" timestamptz(6));
CREATE TABLE "AdminAction" (id uuid PRIMARY KEY,"adminId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,"targetUserId" uuid REFERENCES "User"(id) ON DELETE RESTRICT,action varchar(64) NOT NULL,reason varchar(1000) NOT NULL,"createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp());
CREATE FUNCTION orvok_current_actor() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT s."userId" FROM public."AuthSession" s JOIN public."User" u ON u.id=s."userId"
  WHERE s."tokenHash"=current_setting('orvok.session_hash',true) AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND u.status='ACTIVE' LIMIT 1
$$;
REVOKE ALL ON FUNCTION orvok_current_actor() FROM PUBLIC;
CREATE FUNCTION orvok_social_member(p_group uuid,p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public."SocialGroupMember" m WHERE m."groupId"=p_group AND m."userId"=p_user AND m.state='ACTIVE')
$$;
REVOKE ALL ON FUNCTION orvok_social_member(uuid,uuid) FROM PUBLIC;
CREATE FUNCTION orvok_social_notify(p_recipient uuid,p_type text,p_source uuid) RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  INSERT INTO public."Notification" (id,"recipientId","eventType","sourceId","sourceVersion") VALUES (gen_random_uuid(),p_recipient,p_type,p_source,1) ON CONFLICT DO NOTHING
$$;
REVOKE ALL ON FUNCTION orvok_social_notify(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_social_notify(uuid,text,uuid) TO orvok_app_runtime;
CREATE INDEX social_group_member_user ON "SocialGroupMember" ("userId");
CREATE INDEX social_post_created ON "SocialPost" ("createdAt",id);
CREATE INDEX social_message_recipient ON "SocialMessage" ("recipientId","createdAt");
CREATE INDEX social_report_state ON "SocialReport" (state,"createdAt");
ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialGroupMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialGroupInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialGroupEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAction" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON "UserProfile","SocialGroup","SocialGroupMember","SocialGroupInvitation","SocialGroupEvent","SocialPost","SocialComment","SocialReaction","SocialMessage","SocialBlock","SocialReport" TO orvok_app_runtime;
GRANT SELECT,INSERT ON "AdminAction" TO orvok_app_runtime;
CREATE POLICY social_profile_select ON "UserProfile" FOR SELECT TO orvok_app_runtime USING (true);
CREATE POLICY social_profile_write ON "UserProfile" FOR INSERT TO orvok_app_runtime WITH CHECK ("userId"=orvok_current_actor());
CREATE POLICY social_profile_update ON "UserProfile" FOR UPDATE TO orvok_app_runtime USING ("userId"=orvok_current_actor()) WITH CHECK ("userId"=orvok_current_actor());
CREATE POLICY social_group_access ON "SocialGroup" FOR SELECT TO orvok_app_runtime USING (orvok_social_member(id,orvok_current_actor()));
CREATE POLICY social_group_insert ON "SocialGroup" FOR INSERT TO orvok_app_runtime WITH CHECK ("ownerId"=orvok_current_actor());
CREATE POLICY social_member_access ON "SocialGroupMember" FOR ALL TO orvok_app_runtime USING ("userId"=orvok_current_actor() OR orvok_social_member("groupId",orvok_current_actor()));
CREATE POLICY social_invite_select ON "SocialGroupInvitation" FOR SELECT TO orvok_app_runtime USING ("inviteeId"=orvok_current_actor() OR "inviterId"=orvok_current_actor());
CREATE POLICY social_invite_insert ON "SocialGroupInvitation" FOR INSERT TO orvok_app_runtime WITH CHECK ("inviterId"=orvok_current_actor());
CREATE POLICY social_invite_update ON "SocialGroupInvitation" FOR UPDATE TO orvok_app_runtime USING ("inviteeId"=orvok_current_actor() OR "inviterId"=orvok_current_actor()) WITH CHECK ("inviteeId"=orvok_current_actor() OR "inviterId"=orvok_current_actor());
CREATE POLICY social_event_access ON "SocialGroupEvent" FOR ALL TO orvok_app_runtime USING (orvok_social_member("groupId",orvok_current_actor())) WITH CHECK ("creatorId"=orvok_current_actor());
CREATE POLICY social_post_access ON "SocialPost" FOR ALL TO orvok_app_runtime USING ("authorId"=orvok_current_actor() OR "groupId" IS NULL OR orvok_social_member("groupId",orvok_current_actor())) WITH CHECK ("authorId"=orvok_current_actor());
CREATE POLICY social_comment_access ON "SocialComment" FOR ALL TO orvok_app_runtime USING ("authorId"=orvok_current_actor() OR EXISTS (SELECT 1 FROM "SocialPost" p WHERE p.id="postId")) WITH CHECK ("authorId"=orvok_current_actor());
CREATE POLICY social_reaction_access ON "SocialReaction" FOR ALL TO orvok_app_runtime USING ("userId"=orvok_current_actor() OR EXISTS (SELECT 1 FROM "SocialPost" p WHERE p.id="postId")) WITH CHECK ("userId"=orvok_current_actor());
CREATE POLICY social_message_access ON "SocialMessage" FOR ALL TO orvok_app_runtime USING ("senderId"=orvok_current_actor() OR "recipientId"=orvok_current_actor()) WITH CHECK ("senderId"=orvok_current_actor());
CREATE POLICY social_block_access ON "SocialBlock" FOR ALL TO orvok_app_runtime USING ("blockerId"=orvok_current_actor() OR "blockedId"=orvok_current_actor()) WITH CHECK ("blockerId"=orvok_current_actor());
CREATE POLICY social_report_access ON "SocialReport" FOR ALL TO orvok_app_runtime USING ("reporterId"=orvok_current_actor() OR EXISTS (SELECT 1 FROM "User" u WHERE u.id=orvok_current_actor() AND u.role IN ('ADMIN','MODERATOR'))) WITH CHECK ("reporterId"=orvok_current_actor());
CREATE POLICY admin_action_access ON "AdminAction" FOR SELECT TO orvok_app_runtime USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id=orvok_current_actor() AND u.role IN ('ADMIN','MODERATOR')));
CREATE POLICY admin_action_insert ON "AdminAction" FOR INSERT TO orvok_app_runtime WITH CHECK ("adminId"=orvok_current_actor() AND EXISTS (SELECT 1 FROM "User" u WHERE u.id=orvok_current_actor() AND u.role IN ('ADMIN','MODERATOR')));

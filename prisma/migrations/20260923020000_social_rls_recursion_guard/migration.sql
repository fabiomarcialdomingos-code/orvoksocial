CREATE OR REPLACE FUNCTION orvok_social_is_member(p_group uuid, p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public."SocialGroupMember" m WHERE m."groupId"=p_group AND m."userId"=p_user AND m.state='ACTIVE')
$$;
CREATE OR REPLACE FUNCTION orvok_social_can_manage(p_group uuid, p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public."SocialGroupMember" m WHERE m."groupId"=p_group AND m."userId"=p_user AND m.role IN ('OWNER','MODERATOR') AND m.state='ACTIVE')
$$;
REVOKE ALL ON FUNCTION orvok_social_is_member(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION orvok_social_can_manage(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_social_is_member(uuid,uuid) TO orvok_app_runtime;
GRANT EXECUTE ON FUNCTION orvok_social_can_manage(uuid,uuid) TO orvok_app_runtime;

DROP POLICY IF EXISTS social_group_access ON "SocialGroup";
DROP POLICY IF EXISTS social_group_insert ON "SocialGroup";
CREATE POLICY social_group_access ON "SocialGroup" FOR SELECT TO orvok_app_runtime USING (orvok_social_is_member(id,orvok_current_actor()));
CREATE POLICY social_group_insert ON "SocialGroup" FOR INSERT TO orvok_app_runtime WITH CHECK ("ownerId"=orvok_current_actor());

DROP POLICY IF EXISTS social_member_select ON "SocialGroupMember";
DROP POLICY IF EXISTS social_member_insert ON "SocialGroupMember";
DROP POLICY IF EXISTS social_member_update ON "SocialGroupMember";
CREATE POLICY social_member_select ON "SocialGroupMember" FOR SELECT TO orvok_app_runtime USING ("userId"=orvok_current_actor() OR orvok_social_is_member("groupId",orvok_current_actor()));
CREATE POLICY social_member_insert ON "SocialGroupMember" FOR INSERT TO orvok_app_runtime WITH CHECK ("userId"=orvok_current_actor() OR orvok_social_can_manage("groupId",orvok_current_actor()));
CREATE POLICY social_member_update ON "SocialGroupMember" FOR UPDATE TO orvok_app_runtime USING ("userId"=orvok_current_actor() OR orvok_social_can_manage("groupId",orvok_current_actor())) WITH CHECK ("userId"=orvok_current_actor() OR orvok_social_can_manage("groupId",orvok_current_actor()));

DROP POLICY IF EXISTS social_event_select ON "SocialGroupEvent";
DROP POLICY IF EXISTS social_event_insert ON "SocialGroupEvent";
DROP POLICY IF EXISTS social_event_update ON "SocialGroupEvent";
CREATE POLICY social_event_select ON "SocialGroupEvent" FOR SELECT TO orvok_app_runtime USING (orvok_social_is_member("groupId",orvok_current_actor()));
CREATE POLICY social_event_insert ON "SocialGroupEvent" FOR INSERT TO orvok_app_runtime WITH CHECK ("creatorId"=orvok_current_actor() AND orvok_social_can_manage("groupId",orvok_current_actor()));
CREATE POLICY social_event_update ON "SocialGroupEvent" FOR UPDATE TO orvok_app_runtime USING (orvok_social_can_manage("groupId",orvok_current_actor())) WITH CHECK (orvok_social_can_manage("groupId",orvok_current_actor()));

DROP POLICY IF EXISTS social_post_select ON "SocialPost";
DROP POLICY IF EXISTS social_post_insert ON "SocialPost";
CREATE POLICY social_post_select ON "SocialPost" FOR SELECT TO orvok_app_runtime USING ("authorId"=orvok_current_actor() OR "groupId" IS NULL OR orvok_social_is_member("groupId",orvok_current_actor()));
CREATE POLICY social_post_insert ON "SocialPost" FOR INSERT TO orvok_app_runtime WITH CHECK ("authorId"=orvok_current_actor() AND ("groupId" IS NULL OR orvok_social_is_member("groupId",orvok_current_actor())));

DROP POLICY IF EXISTS social_comment_select ON "SocialComment";
CREATE POLICY social_comment_select ON "SocialComment" FOR SELECT TO orvok_app_runtime USING ("authorId"=orvok_current_actor() OR EXISTS (SELECT 1 FROM public."SocialPost" p WHERE p.id="postId"));

DROP POLICY IF EXISTS social_reaction_select ON "SocialReaction";
CREATE POLICY social_reaction_select ON "SocialReaction" FOR SELECT TO orvok_app_runtime USING ("userId"=orvok_current_actor() OR EXISTS (SELECT 1 FROM public."SocialPost" p WHERE p.id="postId"));

DROP POLICY IF EXISTS social_invite_access ON "SocialGroupInvitation";
DROP POLICY IF EXISTS social_invite_select ON "SocialGroupInvitation";
DROP POLICY IF EXISTS social_invite_insert ON "SocialGroupInvitation";
DROP POLICY IF EXISTS social_invite_update ON "SocialGroupInvitation";
CREATE POLICY social_invite_select ON "SocialGroupInvitation" FOR SELECT TO orvok_app_runtime USING ("inviteeId"=orvok_current_actor() OR "inviterId"=orvok_current_actor());
CREATE POLICY social_invite_insert ON "SocialGroupInvitation" FOR INSERT TO orvok_app_runtime WITH CHECK ("inviterId"=orvok_current_actor() AND orvok_social_can_manage("groupId",orvok_current_actor()));
CREATE POLICY social_invite_update ON "SocialGroupInvitation" FOR UPDATE TO orvok_app_runtime USING ("inviteeId"=orvok_current_actor() OR "inviterId"=orvok_current_actor()) WITH CHECK ("inviteeId"=orvok_current_actor() OR "inviterId"=orvok_current_actor());

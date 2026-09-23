-- Restrict direct runtime DML to the actor and the operation's actual role.
DROP POLICY IF EXISTS social_member_access ON "SocialGroupMember";
CREATE POLICY social_member_select ON "SocialGroupMember" FOR SELECT TO orvok_app_runtime USING (
  "userId"=orvok_current_actor() OR orvok_social_member("groupId",orvok_current_actor())
);
CREATE POLICY social_member_insert ON "SocialGroupMember" FOR INSERT TO orvok_app_runtime WITH CHECK (
  "userId"=orvok_current_actor() OR orvok_social_member("groupId",orvok_current_actor())
);
CREATE POLICY social_member_update ON "SocialGroupMember" FOR UPDATE TO orvok_app_runtime USING (
  "userId"=orvok_current_actor() OR orvok_social_member("groupId",orvok_current_actor())
) WITH CHECK (
  "userId"=orvok_current_actor() OR EXISTS (SELECT 1 FROM "SocialGroupMember" x WHERE x."groupId"="groupId" AND x."userId"=orvok_current_actor() AND x.role IN ('OWNER','MODERATOR') AND x.state='ACTIVE')
);

DROP POLICY IF EXISTS social_event_access ON "SocialGroupEvent";
CREATE POLICY social_event_select ON "SocialGroupEvent" FOR SELECT TO orvok_app_runtime USING (orvok_social_member("groupId",orvok_current_actor()));
CREATE POLICY social_event_insert ON "SocialGroupEvent" FOR INSERT TO orvok_app_runtime WITH CHECK ("creatorId"=orvok_current_actor() AND orvok_social_member("groupId",orvok_current_actor()));
CREATE POLICY social_event_update ON "SocialGroupEvent" FOR UPDATE TO orvok_app_runtime USING (orvok_social_member("groupId",orvok_current_actor())) WITH CHECK (orvok_social_member("groupId",orvok_current_actor()));

DROP POLICY IF EXISTS social_post_access ON "SocialPost";
CREATE POLICY social_post_select ON "SocialPost" FOR SELECT TO orvok_app_runtime USING ("authorId"=orvok_current_actor() OR "groupId" IS NULL OR orvok_social_member("groupId",orvok_current_actor()));
CREATE POLICY social_post_insert ON "SocialPost" FOR INSERT TO orvok_app_runtime WITH CHECK ("authorId"=orvok_current_actor() AND ("groupId" IS NULL OR orvok_social_member("groupId",orvok_current_actor())));
CREATE POLICY social_post_update ON "SocialPost" FOR UPDATE TO orvok_app_runtime USING ("authorId"=orvok_current_actor()) WITH CHECK ("authorId"=orvok_current_actor());

DROP POLICY IF EXISTS social_comment_access ON "SocialComment";
CREATE POLICY social_comment_select ON "SocialComment" FOR SELECT TO orvok_app_runtime USING ("authorId"=orvok_current_actor() OR EXISTS (SELECT 1 FROM "SocialPost" p WHERE p.id="postId"));
CREATE POLICY social_comment_insert ON "SocialComment" FOR INSERT TO orvok_app_runtime WITH CHECK ("authorId"=orvok_current_actor());
CREATE POLICY social_comment_update ON "SocialComment" FOR UPDATE TO orvok_app_runtime USING ("authorId"=orvok_current_actor()) WITH CHECK ("authorId"=orvok_current_actor());

DROP POLICY IF EXISTS social_reaction_access ON "SocialReaction";
CREATE POLICY social_reaction_select ON "SocialReaction" FOR SELECT TO orvok_app_runtime USING ("userId"=orvok_current_actor() OR EXISTS (SELECT 1 FROM "SocialPost" p WHERE p.id="postId"));
CREATE POLICY social_reaction_insert ON "SocialReaction" FOR INSERT TO orvok_app_runtime WITH CHECK ("userId"=orvok_current_actor());

DROP POLICY IF EXISTS social_message_access ON "SocialMessage";
CREATE POLICY social_message_select ON "SocialMessage" FOR SELECT TO orvok_app_runtime USING ("senderId"=orvok_current_actor() OR "recipientId"=orvok_current_actor());
CREATE POLICY social_message_insert ON "SocialMessage" FOR INSERT TO orvok_app_runtime WITH CHECK ("senderId"=orvok_current_actor() AND NOT EXISTS (SELECT 1 FROM "SocialBlock" b WHERE (b."blockerId"="senderId" AND b."blockedId"="recipientId") OR (b."blockerId"="recipientId" AND b."blockedId"="senderId")));
CREATE POLICY social_message_update ON "SocialMessage" FOR UPDATE TO orvok_app_runtime USING ("recipientId"=orvok_current_actor()) WITH CHECK ("recipientId"=orvok_current_actor());

DROP POLICY IF EXISTS social_report_access ON "SocialReport";
CREATE POLICY social_report_select ON "SocialReport" FOR SELECT TO orvok_app_runtime USING ("reporterId"=orvok_current_actor() OR EXISTS (SELECT 1 FROM "User" u WHERE u.id=orvok_current_actor() AND u.role IN ('ADMIN','MODERATOR')));
CREATE POLICY social_report_insert ON "SocialReport" FOR INSERT TO orvok_app_runtime WITH CHECK ("reporterId"=orvok_current_actor());
CREATE POLICY social_report_update ON "SocialReport" FOR UPDATE TO orvok_app_runtime USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id=orvok_current_actor() AND u.role IN ('ADMIN','MODERATOR'))) WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id=orvok_current_actor() AND u.role IN ('ADMIN','MODERATOR')));

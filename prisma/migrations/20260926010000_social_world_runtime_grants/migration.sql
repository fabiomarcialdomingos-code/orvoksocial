-- Every table below already had its RLS policies for orvok_app_runtime
-- (Social/World features, notifications, profile), but the base table
-- grant that RLS depends on was never issued, so every one of these
-- operations failed with 42501 before the policy was ever evaluated.
GRANT UPDATE ON "Notification" TO orvok_app_runtime;
GRANT SELECT, INSERT, UPDATE ON "UserProfile" TO orvok_app_runtime;
GRANT SELECT ON "SocialBlock" TO orvok_app_runtime;
GRANT SELECT, INSERT, UPDATE ON "SocialPost" TO orvok_app_runtime;
GRANT SELECT, INSERT, UPDATE ON "SocialComment" TO orvok_app_runtime;
GRANT SELECT, INSERT ON "SocialReaction" TO orvok_app_runtime;
GRANT SELECT, INSERT, UPDATE ON "SocialMessage" TO orvok_app_runtime;
GRANT SELECT, INSERT, UPDATE ON "SocialReport" TO orvok_app_runtime;
GRANT SELECT, INSERT ON "SocialGroup" TO orvok_app_runtime;
GRANT SELECT, INSERT, UPDATE ON "SocialGroupMember" TO orvok_app_runtime;
GRANT SELECT, INSERT, UPDATE ON "SocialGroupEvent" TO orvok_app_runtime;
GRANT SELECT, INSERT, UPDATE ON "SocialGroupInvitation" TO orvok_app_runtime;
GRANT SELECT, INSERT ON "WorldPrediction" TO orvok_app_runtime;
GRANT SELECT, INSERT ON "WorldResolution" TO orvok_app_runtime;
GRANT SELECT ON "WorldComment" TO orvok_app_runtime;
GRANT SELECT ON "WorldReaction" TO orvok_app_runtime;
-- Admins suspend/unsuspend accounts; only the status column needs to move.
GRANT UPDATE (status) ON "User" TO orvok_app_runtime;

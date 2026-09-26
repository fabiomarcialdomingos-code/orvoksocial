-- Lets an anonymous visitor answer the teaser question (their guess about
-- the inviter) before creating an account, matching the product flow: predict
-- first, sign up to see if you were right.
DROP FUNCTION IF EXISTS orvok_share_link_preview(text);

CREATE FUNCTION orvok_share_link_preview(p_code text)
RETURNS TABLE(active boolean, "displayName" text, theme text, message text, teaser text, "teaserQuestionVersionId" uuid, "teaserOptions" jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT (l."revokedAt" IS NULL AND l."expiresAt" > clock_timestamp() AND l.uses < l."maxUses" AND u.status = 'ACTIVE'),
         COALESCE(p."displayName", 'Alguém'), l.theme, l.message, qv.text, qv.id,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id',ao.id,'label',ao.label,'position',ao.position) ORDER BY ao.position)
                    FROM "AnswerOption" ao WHERE ao."questionVersionId" = qv.id), '[]'::jsonb)
    FROM "RadarShareLink" l
    JOIN "User" u ON u.id = l."ownerId"
    LEFT JOIN "UserProfile" p ON p."userId" = l."ownerId"
    LEFT JOIN "QuestionVersion" qv ON qv.id = l."teaserQuestionVersionId"
   WHERE l.code = p_code
$$;

REVOKE ALL ON FUNCTION orvok_share_link_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION orvok_share_link_preview(text) TO orvok_app_runtime, orvok_auth_runtime;

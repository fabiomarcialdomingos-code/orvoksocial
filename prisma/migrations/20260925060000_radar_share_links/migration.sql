-- Share links: invite people outside ORVOK through WhatsApp, Instagram,
-- Facebook and others. The link says "I am open to be predicted". Redeeming it
-- creates an ordinary Radar request FROM the recipient TO the owner, so the
-- owner still accepts and consents explicitly: the consent model is unchanged.
CREATE TABLE "RadarShareLink" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(16) NOT NULL UNIQUE CHECK (code ~ '^[A-Za-z0-9]{8,16}$'),
  "ownerId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  theme varchar(16) NOT NULL DEFAULT 'noite' CHECK (theme IN ('noite','aurora','mineral')),
  "teaserQuestionVersionId" uuid REFERENCES "QuestionVersion"(id) ON DELETE RESTRICT,
  message varchar(140),
  uses integer NOT NULL DEFAULT 0 CHECK (uses >= 0),
  "maxUses" integer NOT NULL DEFAULT 50 CHECK ("maxUses" BETWEEN 1 AND 500),
  "createdAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  "expiresAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp() + interval '30 days',
  "revokedAt" timestamptz(6),
  CHECK ("expiresAt" > "createdAt")
);
CREATE INDEX "RadarShareLink_owner_idx" ON "RadarShareLink" ("ownerId", "createdAt" DESC);

CREATE TABLE "RadarShareRedemption" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "linkId" uuid NOT NULL REFERENCES "RadarShareLink"(id) ON DELETE RESTRICT,
  "recipientId" uuid NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  "invitationId" uuid REFERENCES "RadarInvitation"(id) ON DELETE RESTRICT,
  "redeemedAt" timestamptz(6) NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("linkId", "recipientId")
);

ALTER TABLE "RadarShareLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RadarShareRedemption" ENABLE ROW LEVEL SECURITY;
CREATE POLICY share_link_owner_select ON "RadarShareLink" FOR SELECT TO orvok_app_runtime
  USING ("ownerId" = orvok_read_actor());
CREATE POLICY share_link_owner_insert ON "RadarShareLink" FOR INSERT TO orvok_app_runtime
  WITH CHECK ("ownerId" = orvok_read_actor());
CREATE POLICY share_link_owner_update ON "RadarShareLink" FOR UPDATE TO orvok_app_runtime
  USING ("ownerId" = orvok_read_actor()) WITH CHECK ("ownerId" = orvok_read_actor());
CREATE POLICY share_redemption_select ON "RadarShareRedemption" FOR SELECT TO orvok_app_runtime
  USING ("recipientId" = orvok_read_actor() OR EXISTS (
    SELECT 1 FROM "RadarShareLink" l WHERE l.id = "linkId" AND l."ownerId" = orvok_read_actor()));

-- Public preview for the landing page and the social card image. Exposes only
-- the owner's display name, theme, message and teaser question text.
CREATE OR REPLACE FUNCTION orvok_share_link_preview(p_code text)
RETURNS TABLE(active boolean, "displayName" text, theme text, message text, teaser text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT (l."revokedAt" IS NULL AND l."expiresAt" > clock_timestamp() AND l.uses < l."maxUses" AND u.status = 'ACTIVE'),
         COALESCE(p."displayName", 'Alguém'), l.theme, l.message, qv.text
    FROM public."RadarShareLink" l
    JOIN public."User" u ON u.id = l."ownerId"
    LEFT JOIN public."UserProfile" p ON p."userId" = l."ownerId"
    LEFT JOIN public."QuestionVersion" qv ON qv.id = l."teaserQuestionVersionId"
   WHERE l.code = p_code
$$;

-- Redeem: the signed-in recipient becomes the predictor of the link owner.
CREATE OR REPLACE FUNCTION orvok_share_link_redeem(p_session_hash text, p_code text)
RETURNS TABLE(invitation_id uuid, owner_id uuid, created boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_actor uuid; v_link public."RadarShareLink"; v_invitation uuid; v_existing uuid;
BEGIN
  v_actor := public.orvok_radar_actor(p_session_hash);
  SELECT * INTO v_link FROM public."RadarShareLink" WHERE code = p_code FOR UPDATE;
  IF NOT FOUND OR v_link."revokedAt" IS NOT NULL OR v_link."expiresAt" <= clock_timestamp()
     OR v_link.uses >= v_link."maxUses" THEN
    RAISE EXCEPTION 'share link unavailable' USING ERRCODE = '23514';
  END IF;
  IF v_link."ownerId" = v_actor THEN
    RAISE EXCEPTION 'own share link' USING ERRCODE = '23514';
  END IF;
  SELECT "invitationId" INTO v_existing FROM public."RadarShareRedemption"
    WHERE "linkId" = v_link.id AND "recipientId" = v_actor;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing, v_link."ownerId", false; RETURN;
  END IF;
  SELECT i.id INTO v_existing FROM public."RadarInvitation" i
    LEFT JOIN public."RadarInvitationAcceptance" a ON a."invitationId" = i.id
   WHERE i."predictorId" = v_actor AND i."targetId" = v_link."ownerId"
     AND (a.id IS NOT NULL OR i."expiresAt" IS NULL OR i."expiresAt" > clock_timestamp())
   LIMIT 1;
  IF v_existing IS NULL THEN
    v_invitation := public.orvok_radar_invite(p_session_hash, v_link."ownerId");
  ELSE
    v_invitation := v_existing;
  END IF;
  INSERT INTO public."RadarShareRedemption" ("linkId", "recipientId", "invitationId") VALUES (v_link.id, v_actor, v_invitation);
  UPDATE public."RadarShareLink" SET uses = uses + 1 WHERE id = v_link.id;
  INSERT INTO public."Notification" (id, "recipientId", "eventType", "sourceId", "sourceVersion", state, "createdAt")
    VALUES (gen_random_uuid(), v_link."ownerId", 'RADAR_SHARE_LINK_REDEEMED', v_invitation, 1, 'UNREAD', clock_timestamp());
  INSERT INTO public."AuditLog" (id, "actorId", action, "objectType", "objectId", "occurredAt")
    VALUES (gen_random_uuid(), v_actor, 'RADAR_SHARE_LINK_REDEEMED', 'RadarShareLink', v_link.id, clock_timestamp());
  RETURN QUERY SELECT v_invitation, v_link."ownerId", v_existing IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION orvok_share_link_preview(text), orvok_share_link_redeem(text, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orvok_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON "RadarShareLink" TO orvok_app_runtime;
    GRANT SELECT ON "RadarShareRedemption" TO orvok_app_runtime;
    GRANT EXECUTE ON FUNCTION orvok_share_link_redeem(text, text), orvok_share_link_preview(text) TO orvok_app_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orvok_auth_runtime') THEN
    GRANT EXECUTE ON FUNCTION orvok_share_link_preview(text) TO orvok_auth_runtime;
  END IF;
END $$;

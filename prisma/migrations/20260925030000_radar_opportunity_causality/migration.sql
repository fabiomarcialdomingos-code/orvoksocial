-- Only list opportunities that orvok_radar_predict_core will accept: the
-- target's latest answer must postdate the consent grant (causal order).
-- Previously such rows were listed and every prediction failed with 422.
CREATE OR REPLACE FUNCTION public.orvok_radar_opportunities(p_session_hash text)
 RETURNS TABLE("targetId" uuid, "grantId" uuid, "questionVersionId" uuid, "selfAnswerVersionId" uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  WITH actor AS (SELECT public.orvok_radar_actor(p_session_hash) AS id)
  SELECT i."targetId",g.id,qv.id,self_answer.id
  FROM actor
  JOIN public."RadarInvitation" i ON i."predictorId"=actor.id
  JOIN public."RadarInvitationAcceptance" a ON a."invitationId"=i.id
  JOIN public."ConsentGrant" g ON g."invitationAcceptanceId"=a.id
    AND g."subjectId"=i."targetId" AND g.purpose='BE_PREDICTED'
  JOIN public."User" target ON target.id=i."targetId" AND target.status='ACTIVE'
  JOIN public."QuestionVersion" qv ON public.orvok_catalog_version_enabled(qv.id)
  JOIN LATERAL (SELECT av.id,av."consentGrantId" FROM public."AnswerVersion" av
    WHERE av."subjectId"=actor.id AND av."questionVersionId"=qv.id
    ORDER BY av.version DESC LIMIT 1) self_answer ON true
  JOIN LATERAL (SELECT av.id,av."consentGrantId",av."answeredAt" FROM public."AnswerVersion" av
    WHERE av."subjectId"=i."targetId" AND av."questionVersionId"=qv.id
    ORDER BY av.version DESC LIMIT 1) target_answer ON true
  WHERE target_answer."answeredAt"<clock_timestamp()
    AND g."grantedAt"<target_answer."answeredAt"
    AND public.orvok_radar_consent_operational(g.id)
    AND public.orvok_radar_consent_operational(self_answer."consentGrantId")
    AND public.orvok_radar_consent_operational(target_answer."consentGrantId")
  ORDER BY i."targetId",g.id,qv.id
$function$

;

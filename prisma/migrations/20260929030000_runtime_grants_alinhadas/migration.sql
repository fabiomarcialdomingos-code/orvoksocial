-- Alinha as permissões de tabela do papel do site com as do script de
-- provisionamento (scripts/provision-runtime-roles.ts). Em produção o script
-- não foi executado de novo depois de 20260926010000, que concedeu apenas
-- SELECT em "WorldComment" e "WorldReaction": comentar e reagir numa previsão
-- falhava com 42501 ("Esta conta não tem permissão"). As linhas continuam
-- protegidas pelas políticas RLS de cada tabela.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='orvok_app_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON "UserProfile","SocialGroup","SocialGroupMember","SocialGroupInvitation","SocialGroupEvent",
      "SocialPost","SocialComment","SocialReaction","SocialMessage","SocialBlock","SocialReport" TO orvok_app_runtime;
    GRANT SELECT,INSERT,UPDATE ON "WorldCategory","WorldEvent","WorldOpportunity","WorldPrediction","WorldResolution",
      "WorldComment","WorldReaction" TO orvok_app_runtime;
    GRANT SELECT,INSERT ON "AdminAction" TO orvok_app_runtime;
  END IF;
END $$;

-- Retrato "como você se vê vs. como te veem".
-- Só entram no retrato as tentativas feitas depois do aviso que explica isso a
-- quem responde; a versão do aviso fica registrada na própria tentativa.
-- Tentativas antigas (sem versão) continuam servindo apenas para o placar.
ALTER TABLE "GuestChallengeAttempt" ADD COLUMN "portraitNoticeVersion" varchar(40);

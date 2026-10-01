-- Aviso automático de eventos pré-cadastrados: quando faltar cerca de uma
-- semana para o evento, o admin recebe uma notificação para revisar e
-- decidir se publica. "notifiedAt" evita avisar duas vezes pelo mesmo evento.
ALTER TABLE "WorldEvent" ADD COLUMN "notifiedAt" timestamptz;

-- Garante as 4 categorias do Mundo entre pessoas.
INSERT INTO "WorldCategory" (id,slug,name) VALUES
  (gen_random_uuid(),'economia','Economia'),
  (gen_random_uuid(),'tecnologia','Tecnologia'),
  (gen_random_uuid(),'esporte','Esporte'),
  (gen_random_uuid(),'entretenimento','Entretenimento')
ON CONFLICT (slug) DO NOTHING;

-- Eventos pré-cadastrados (rascunho) pesquisados para 10/10 a 31/12/2026.
-- Ficam como DRAFT: só entram no Mundo quando o Fabio revisar e publicar
-- pelo Quartel general. Os textos e as opções podem ser ajustados antes de
-- publicar. Datas e fontes consultadas em 01/10/2026; podem mudar (jogo
-- remarcado, decisão antecipada etc.) — por isso a própria revisão existe.
DO $$
DECLARE
  admin_id uuid;
  cat_esporte uuid; cat_economia uuid; cat_tecnologia uuid; cat_entretenimento uuid;
  eid uuid;
BEGIN
  SELECT id INTO admin_id FROM "User" WHERE role IN ('ADMIN','MODERATOR') AND status='ACTIVE' ORDER BY "createdAt" ASC LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE NOTICE 'Nenhum admin encontrado; eventos pré-cadastrados não foram criados.';
    RETURN;
  END IF;
  SELECT id INTO cat_esporte FROM "WorldCategory" WHERE slug='esporte';
  SELECT id INTO cat_economia FROM "WorldCategory" WHERE slug='economia';
  SELECT id INTO cat_tecnologia FROM "WorldCategory" WHERE slug='tecnologia';
  SELECT id INTO cat_entretenimento FROM "WorldCategory" WHERE slug='entretenimento';

  -- 1) Bola de Ouro 2026 — cerimônia em Londres, 26/10/2026.
  eid := 'a1a10000-0000-4000-8000-000000000001';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_esporte,'Bola de Ouro 2026: Vini Jr. é eleito o melhor do mundo?',
     'Cerimônia da France Football/Uefa em Londres, 26/10/2026. Vini Jr. é um dos indicados ao prêmio masculino.',
     'Resolve Sim se Vinícius Júnior vencer o prêmio de melhor jogador (masculino) na cerimônia; Não caso contrário.',
     clock_timestamp(),'2026-10-26 17:00-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 2) Fed — decisão de outubro, 28/10/2026.
  eid := 'a1a10000-0000-4000-8000-000000000002';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_economia,'O Federal Reserve corta os juros em outubro?',
     'Reunião do FOMC em 27 e 28/10/2026. Decisão anunciada no fim do segundo dia.',
     'Resolve Sim se o Fed reduzir a taxa básica de juros dos EUA nesta reunião; Não se mantiver ou subir.',
     clock_timestamp(),'2026-10-28 15:30-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 3) Copa do Brasil 2026 — semifinal, jogos de volta em 07 e 08/11/2026.
  eid := 'a1a10000-0000-4000-8000-000000000003';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_esporte,'Semifinais da Copa do Brasil 2026 (volta): tem virada?',
     'Jogos de volta das semifinais em 07/11 (Belo Horizonte) e 08/11/2026 (Rio de Janeiro).',
     'Resolve Sim se algum dos dois confrontos definir o finalista com uma virada de placar agregado no jogo de volta; Não caso os resultados da ida se confirmem nos dois.',
     clock_timestamp(),'2026-11-08 22:00-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 4) F1 — GP de São Paulo (Interlagos), corrida em 08/11/2026.
  eid := 'a1a10000-0000-4000-8000-000000000004';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_esporte,'GP de São Paulo de F1 2026: tem safety car ou bandeira vermelha?',
     'Corrida em Interlagos, domingo 08/11/2026, 14h (horário local).',
     'Resolve Sim se o safety car (ou virtual) ou bandeira vermelha entrar em algum momento da corrida; Não se a corrida correr sem interrupções.',
     clock_timestamp(),'2026-11-08 17:00-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 5) Copom — decisão de novembro, 03 e 04/11/2026.
  eid := 'a1a10000-0000-4000-8000-000000000005';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_economia,'O Copom corta a Selic em novembro?',
     'Reunião do Copom em 03 e 04/11/2026. Comunicado divulgado ao fim do segundo dia.',
     'Resolve Sim se o Copom reduzir a taxa Selic nesta reunião; Não se mantiver ou subir.',
     clock_timestamp(),'2026-11-04 18:30-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 6) Grammy Latino 2026 — cerimônia em Las Vegas, 12/11/2026.
  eid := 'a1a10000-0000-4000-8000-000000000006';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_entretenimento,'Grammy Latino 2026: Anitta vence Álbum do Ano?',
     'Cerimônia em Las Vegas, 12/11/2026. Anitta concorre com "EQUILIBRIVM" contra Rosalía, Karol G e outros.',
     'Resolve Sim se Anitta vencer a categoria Álbum do Ano; Não caso outro artista vença.',
     clock_timestamp(),'2026-11-13 02:00-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 7) GTA 6 — lançamento previsto para 19/11/2026 (PS5 e Xbox Series X/S).
  eid := 'a1a10000-0000-4000-8000-000000000007';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_tecnologia,'GTA 6 é lançado em 19 de novembro, como prometido?',
     'A Take-Two confirmou e reafirmou várias vezes o lançamento para 19/11/2026, após dois adiamentos anteriores.',
     'Resolve Sim se GTA 6 ficar disponível para compra em 19/11/2026 nos consoles anunciados; Não em caso de novo adiamento.',
     clock_timestamp(),'2026-11-19 22:00-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 8) Grammy 2027 — indicados anunciados em 16/11/2026.
  eid := 'a1a10000-0000-4000-8000-000000000008';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_entretenimento,'Taylor Swift é indicada a Álbum do Ano no Grammy 2027?',
     'Indicados ao 69º Grammy Awards anunciados em 16/11/2026. "The Life of a Showgirl" é elegível.',
     'Resolve Sim se o álbum de Taylor Swift constar entre os indicados a Álbum do Ano; Não caso contrário.',
     clock_timestamp(),'2026-11-16 14:00-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 9) Black Friday 2026 — última sexta-feira de novembro, 27/11/2026.
  eid := 'a1a10000-0000-4000-8000-000000000009';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_tecnologia,'Black Friday 2026 fatura mais que a de 2025 no Brasil?',
     'Comparação divulgada por consultorias do setor (ex.: Neotrust/Compre&Confie) nos dias seguintes à data.',
     'Resolve Sim se o faturamento do e-commerce brasileiro na Black Friday 2026 superar o de 2025, segundo os levantamentos do setor; Não caso contrário.',
     clock_timestamp(),'2026-11-30 23:59-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 10) Libertadores 2026 — final em Montevidéu, 28/11/2026.
  eid := 'a1a10000-0000-4000-8000-00000000000a';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_esporte,'Um time brasileiro é campeão da Libertadores 2026?',
     'Final em jogo único no Estádio Centenário, Montevidéu, 28/11/2026. Flamengo, Palmeiras e Fluminense chegaram à semifinal.',
     'Resolve Sim se o campeão da Libertadores 2026 for um clube brasileiro; Não caso contrário.',
     clock_timestamp(),'2026-11-28 20:00-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 11) Brasileirão 2026 — última rodada, 02/12/2026.
  eid := 'a1a10000-0000-4000-8000-00000000000b';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_esporte,'Quem lidera o Brasileirão antes da última rodada fecha campeão?',
     'Última (38ª) rodada do Brasileirão 2026 em 02/12/2026, com todos os jogos no mesmo horário.',
     'Resolve Sim se o time que entrar na última rodada na liderança terminar campeão; Não se houver virada no título.',
     clock_timestamp(),'2026-12-02 22:00-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 12) Copa do Brasil 2026 — final em jogo único, 06/12/2026.
  eid := 'a1a10000-0000-4000-8000-00000000000c';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_esporte,'A final da Copa do Brasil 2026 vai para os pênaltis?',
     'Primeira final em jogo único da Copa do Brasil, 06/12/2026.',
     'Resolve Sim se o resultado do tempo normal (e prorrogação, se houver) terminar empatado e o campeão for decidido nos pênaltis; Não se houver vencedor antes disso.',
     clock_timestamp(),'2026-12-06 22:00-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 13) Fed — decisão de dezembro, 08 e 09/12/2026.
  eid := 'a1a10000-0000-4000-8000-00000000000d';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_economia,'O Federal Reserve corta os juros em dezembro?',
     'Reunião do FOMC em 08 e 09/12/2026, a última do ano.',
     'Resolve Sim se o Fed reduzir a taxa básica de juros dos EUA nesta reunião; Não se mantiver ou subir.',
     clock_timestamp(),'2026-12-09 15:30-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 14) Copom — decisão de dezembro, 08 e 09/12/2026 (última do ano).
  eid := 'a1a10000-0000-4000-8000-00000000000e';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_economia,'O Copom corta a Selic em dezembro?',
     'Reunião do Copom em 08 e 09/12/2026, a última do ano.',
     'Resolve Sim se o Copom reduzir a taxa Selic nesta reunião; Não se mantiver ou subir.',
     clock_timestamp(),'2026-12-09 18:30-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  -- 15) Copa Intercontinental 2026 — entre 09 e 16/12/2026.
  eid := 'a1a10000-0000-4000-8000-00000000000f';
  INSERT INTO "WorldEvent" (id,"categoryId",title,description,"resolutionCriteria","opensAt","closesAt",status,"createdById") VALUES
    (eid,cat_esporte,'Um time europeu é campeão da Copa Intercontinental 2026?',
     'Torneio da Fifa entre campeões continentais, 09 a 16/12/2026.',
     'Resolve Sim se o campeão for um clube europeu; Não se for de outra confederação (incluindo um clube sul-americano).',
     clock_timestamp(),'2026-12-16 20:00-03','DRAFT',admin_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "WorldOpportunity" (id,"eventId",code,label,position) VALUES
    (gen_random_uuid(),eid,'S','Sim',0),(gen_random_uuid(),eid,'N','Não',1) ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Eventos pré-cadastrados (DRAFT) criados/confirmados: 15.';
END $$;

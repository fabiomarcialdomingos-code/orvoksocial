# Contratos Radar Social V1 — execução TEST_ONLY

Estado: **somente fixture de desenvolvimento/teste**. A V2 canônica exige convite → aceite → aviso/consentimento → gabarito do alvo → previsão → resolução → avaliação. Por isso, “avaliar quando o alvo responder” após uma previsão não foi implementado: a previsão antes do gabarito contraria a ordem aprovada. Não há Score, RadarScore, γ, consenso, ranking nem métrica de habilidade. O snapshot contém apenas vetor bruto e referência imutável à versão do gabarito, sem revelar a opção do alvo ao previsor.

## Publicação do catálogo

`QuestionVersion` armazena `instrumentVersion`, `catalogStatus` (`TEST_ONLY | CANDIDATE | APPROVED`), `contentHash` e `approvedAt`; opções e versões são append-only. `scripts/import-radar-catalog.ts` aceita apenas `TEST_ONLY` (banco local `_dev`/`_test` com `ORVOK_ALLOW_TEST_SEED=1`) ou `CANDIDATE` (flag explícita `ORVOK_IMPORT_CANDIDATE=1`). Não aceita `APPROVED`. A publicação oficial está bloqueada até haver os 12 itens ratificados, manifesto de IDs/versões/hashes assinado, critérios de aceite e revisão formal. Uma migração owner-side posterior deverá registrar a aprovação, congelar hashes e provar ausência de mudança silenciosa; não há endpoint runtime para publicar. `RadarCatalogControl.allowTestOnly` começa `false`, só o owner altera, e o SQL admite TEST_ONLY apenas em banco local com sufixo `_dev`/`_test`. API em `APP_ENV=staging/production` ou valor desconhecido recusa Radar se houver qualquer material TEST_ONLY, inclusive restaurado de backup. Revogação continua acessível ao titular nesse caso.

`prisma/seed.ts` cria exclusivamente avisos fictícios `TEST_ONLY_SELF_ANSWER_V1` e `TEST_ONLY_BE_PREDICTED_V1` em banco local, sem contas pessoais. `fixtures/radar-catalog-test-only.json` contém dois itens fictícios para testes, não as 12 perguntas oficiais. Avisos de versão `TEST*`/`FIXTURE*` sem `testOnly=true` são excluídos da seleção; novos registros assim são recusados por constraint. Grants históricos ligados a aviso fictício mal classificado permanecem no histórico, mas não autorizam nova resposta, previsão, oportunidade, match nem leitura de snapshot.

## API `/api/v1`

Todas as mutações mantêm sessão verificada, Origin da aplicação, JSON estrito, `Idempotency-Key`, rate limit operacional, resposta `{schemaVersion:"1",...}` e erro `{schemaVersion:"1",code,message,requestId}`. GETs usam `Cache-Control: no-store`. IDs são UUID. Respostas do alvo não são lidas por terceiros.

| Método/rota | Entrada | Saída | Regra |
| --- | --- | --- | --- |
| GET `/radar/questions?cursor=` | cursor opcional | `{items:[{questionVersionId,version,text,instrumentVersion,catalogStatus,options:[{id,label,position}]}],nextCursor}` | Apenas versões `APPROVED` ou `TEST_ONLY` habilitadas localmente; 20 por página. Candidatas invisíveis inclusive por RLS. |
| GET `/radar/answers?cursor=` | cursor UUID em base64url | `{items:[{id,questionVersionId,optionId,version,answeredAt}],nextCursor}` | Respostas Radar próprias, 20 por página; não retorna gabarito de terceiro. |
| GET `/radar/opportunities?cursor=` | cursor opcional | `{items:[{targetId,grantId,questionVersionId,selfAnswerVersionId}],nextCursor}` | Somente convite aceito, consentimentos e respostas vigentes, aviso válido e gabarito prévio; 20 por página, sem opção/ID de resposta do alvo. |
| GET `/radar/dashboard` | — | `{made,received,pendingInvitations,matches,hasMore}` | Até 20 recentes por painel; `hasMore` é booleano por painel. `received` obedece `SHARED`; `PRIVATE` não expõe snapshot ao alvo. Match significa apenas dois convites aceitos e dois grants BE_PREDICTED ativos, sem inferência de compatibilidade. |
| GET `/radar/invitations?cursor=` | cursor | lista 20+cursor, incluindo `expiresAt` nullable | Rejeita duplicidade ativa por par de forma serializada. Nenhum TTL de produto foi fixado: `NULL` significa sem expiração configurada; fixtures com `expiresAt` vencido não podem ser aceitas. |
| GET `/consent-notice?purpose=BE_PREDICTED&acceptanceId=` | purpose, aceite | aviso, hash, versão, presentationId | Apresentação BE_PREDICTED vincula imutavelmente o aceite exato. SELF_ANSWER usa purpose próprio e não aceita aceite. |
| POST `/radar/answers` | `{questionVersionId,optionId,consentGrantId,supersedesId?}` | `{answerVersionId,version}` | SELF_ANSWER ativo; versão mais nova preservada, sem UPDATE. |
| POST `/radar/predictions` | `{targetId,questionVersionId,selfAnswerVersionId,grantId,probabilityVector,supersedesId?}` | `{snapshotId,consentVersion}` | Cria snapshot definitivo após confirmação explícita na UI. Uma raiz por previsor/alvo/item; revisão referencia raiz/ponta anterior. |
| GET `/radar/snapshots/{id}` | id | `{snapshot:{id,predictorId,targetId,questionVersionId,probabilityVector,predictedAt,consentVersion,snapshotHash}}` | Previsor ou alvo em `SHARED`, somente consentimento/catálogo ainda operacional. Nunca retorna a opção do gabarito. |
| GET `/notifications?cursor=` | cursor | inbox próprio com `eventType,state,createdAt` | Eventos operacionais transacionais de convite, aceite e revogação; sem e-mail/push ou conteúdo privado. |
| POST `/notifications/{id}/read` | `{}` | `{id,state:"READ"}` | Dono apenas; `UNREAD→READ`; retry mesma chave idempotente, transição repetida com chave nova conflita. |
| POST `/notifications/{id}/dismiss` | `{}` | `{id,state:"DISMISSED"}` | Dono apenas; `UNREAD/READ→DISMISSED`; terminal. Timestamps atribuídos pelo banco. |

Os endpoints prévios de convite, aceite, grant, revogação, exportação e pedido de exclusão seguem `docs/CONTRATOS_API_OPERACIONAIS_V1.md`. Exportação é técnica; exclusão apenas abre pedido, sem política automática de eliminação/retensão. A revisão jurídica da política provisória e dos avisos é condição anterior a qualquer pessoa real. `hasMore` sem cursor no dashboard identifica uma visão dos 20 registros mais recentes por painel, não a lista completa.

## Invariantes e auditoria

- O app role não possui DML direto em convite, aceite, apresentação, grant, resposta ou snapshot. RPCs SECURITY DEFINER vinculam ator à sessão verificada; RLS protege leitura.
- Aviso, aceite e grant usam o mesmo `invitationAcceptanceId`; apresentação e snapshot são imutáveis. Revogação bloqueia novas previsões e oculta snapshots/reciprocidade futura, preservando histórico restrito.
- Um aceite não pode emitir dois grants `BE_PREDICTED` simultaneamente ativos: o serviço rejeita e audita a repetição, e um trigger SQL serializa a emissão no alvo. Após revogação, novo grant exige o fluxo de apresentação novamente; o grant anterior continua no histórico.
- Trigger de snapshot serializa correção do gabarito por lock do alvo, exige versões mais recentes de resposta própria e do alvo e proveniência de todos os grants. Índice único impede duas previsões iniciais do mesmo par/item; `supersedesId` único impede ramificações.
- Notificações são gravadas na mesma transação de convite/aceite/revogação com unicidade por fonte. Transições READ/DISMISSED são auditadas; `readAt`/`dismissedAt` vêm do relógio do banco, não do cliente.
- `AuditLog` cobre concessões, revogações, previsões e tentativas bloqueadas; nenhuma entrada armazena vetor/gabarito. Consultas de auditoria exigem ADMIN ou titular conforme RLS.

# Contratos operacionais `/api/v1` — fundação V1

Estado: contrato técnico para testes controlados. Os avisos aprovados e o catálogo Radar oficial não são semeados. Fontes: REV02 canônica, `DECISOES_CONTRATOS_FASE_1_V1.md` D07–D13, matriz de acesso operacional e invariantes da Fase 1. Não há Score, consenso, RadarScore ou publicação.

Todas as respostas são JSON UTF-8 com `schemaVersion: "1"` e `Cache-Control: no-store`. Todas as rotas exigem sessão verificada e conta `ACTIVE`. Mutações exigem `Content-Type: application/json`, `Origin` da aplicação e `Idempotency-Key` (16–128 caracteres ASCII seguros). GETs são limitados a 20 itens, com cursor opaco `nextCursor`; o cliente o envia em `?cursor=`. Erro: `{code,message,requestId}`; 400 entrada inválida, 401 sessão ausente/inválida, 403 acesso ou Origin negado, 404 objeto invisível, 409 conflito/replay pendente, 422 invariante, 503 aviso indisponível, 500 erro interno. Sem detalhes internos de banco no corpo.

Limite técnico inicial `API-RATE-01`: 20 convites e 60 outras mutações por ator/rota por minuto, ajustável por `ORVOK_INVITE_RATE_PER_MIN` e `ORVOK_API_MUTATION_RATE_PER_MIN`. Exceder retorna 429. Esses números são configuração operacional inicial, não limiar de produto congelado.

| Método e rota | Entrada | Saída | Autorização / regra |
| --- | --- | --- | --- |
| GET `/users/me` | nenhuma | `{user:{id,status,createdAt}}` | próprio usuário |
| GET `/consent-notice?purpose=BE_PREDICTED&acceptanceId={id}` ou `?purpose=SELF_ANSWER` | finalidade e aceite Radar quando aplicável | `{version,contentHash,content,presentationId}` | sessão verificada; aceite do alvo antes da apresentação Radar; registra entrega vinculada à sessão; 503 sem versão aprovada |
| POST `/radar/invitations` | `{targetId}` | 201 `{invitationId}` | previsor autenticado, alvo distinto; sem busca por e-mail |
| GET `/radar/invitations` | `cursor?` | `{items:[{id,predictorId,targetId,invitedAt,acceptanceId,acceptedAt}],nextCursor}` | somente convites onde é previsor ou alvo |
| POST `/radar/invitations/{id}/accept` | `{}` | 201 `{acceptanceId}` | somente alvo do convite |
| POST `/radar/consents` | `{acceptanceId,presentationId,accepted:true,noticeVersion,noticeHash,scope:PRIVATE\|SHARED}` | 201 `{grantId,consentVersion}` | somente alvo; aviso aprovado apresentado na mesma sessão; aceite precede concessão |
| GET `/radar/consents` | `cursor?` | `{items:[{id,purpose,scope,noticeVersion,consentVersion,grantedAt,revokedAt}],nextCursor}` | grants próprios |
| POST `/radar/consents/{id}/revoke` | `{}` | 201 `{revocationId}` | titular do grant Radar |
| POST `/radar/self-answer-consents` | `{presentationId,accepted:true,noticeVersion,noticeHash}` | 201 `{grantId,consentVersion}` | titular, aviso próprio aprovado e apresentado |
| POST `/radar/self-answer-consents/{id}/revoke` | `{}` | 201 `{revocationId}` | titular do grant de resposta própria |
| POST `/radar/answers` | `{questionVersionId,optionId,consentGrantId,supersedesId?}` | 201 `{answerVersionId,version}` | titular; consentimento `SELF_ANSWER` ativo; opção pertence à versão de pergunta; snapshot imutável |
| POST `/radar/predictions` | `{targetId,questionVersionId,selfAnswerVersionId,grantId,probabilityVector,supersedesId?}` | 201 `{snapshotId,consentVersion}` | previsor do convite; grant do alvo ativo; gabarito do alvo e resposta própria anteriores; vetor compatível com opções |
| GET `/radar/snapshots/{id}` | ID | `{snapshot:{id,predictorId,targetId,questionVersionId,probabilityVector,predictedAt,consentVersion}}` | previsor se privado; previsor ou alvo se compartilhado; somente consentimento ainda ativo; gabarito nunca é retornado |
| GET `/me/export` | nenhuma | JSON de exportação em stream | dados próprios; projeção explícita sem hash de senha, token ou resposta de terceiro; snapshot de leitura repetível, lotes de 100, limite explícito de 100 MiB/120 s; audita acesso |
| POST `/me/export-requests` | `{}` | 202 `{requestId,state:RECEIVED}` | solicita revisão/manual de exportação quando stream excede limite; não promete pacote automático |
| POST `/me/erasure-requests` | `{}` | 202 `{requestId,state:RECEIVED}` | pedido próprio; não apaga ou anonimiza automaticamente |
| GET `/me/data-requests` | `cursor?` | `{items:[{id,type,status,requestedAt}],nextCursor}` | pedidos próprios |
| GET `/notifications` | `cursor?` | `{items:[{id,eventType,state,createdAt}],nextCursor}` | inbox próprio; eventos operacionais de convite, aceite e revogação TEST_ONLY conforme contrato Radar complementar |
| GET `/admin/audit` | `cursor?` | `{items:[{id,actorId,action,objectType,objectId,occurredAt}],nextCursor}` | ADMIN; somente metadados, sem payload privado |

`ApiIdempotency` armazena hash da requisição e resposta curta sem gabarito ou token. Repetir chave/corpo concluído devolve a mesma resposta; mudar corpo ou encontrar `PENDING` retorna 409. `PENDING` não é reexecutado automaticamente depois de falha: exige reconciliação auditada do evento original. Não há prazo de retenção inventado.

A exportação é técnica e limitada ao titular autenticado. O fluxo de exclusão só registra uma solicitação; qualquer decisão de eliminação, retenção ou anonimização depende de revisão jurídica da política provisória. Eventos operacionais de convite, aceite e revogação são emitidos no bloco Radar TEST_ONLY; gatilhos de produto adicionais continuam sem ratificação. Veja [`CONTRATOS_RADAR_SOCIAL_TEST_ONLY_V1.md`](CONTRATOS_RADAR_SOCIAL_TEST_ONLY_V1.md) para catálogo, painéis, oportunidades e transições de inbox. Acesso por papel é sempre rechecado no backend; nenhuma rota publica dados sociais ou perguntas reais.

Se o stream for interrompido por 100 MiB, 120 s, cancelamento ou falha de banco, o corpo não é um pacote íntegro. O cliente deve descartar a resposta e usar `/me/export-requests`; esse pedido fica para processamento/revisão manual, sem prazo inventado e sem promessa de entrega automática. A exportação grande integral ainda é risco operacional aberto.

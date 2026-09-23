# Auditoria independente e propostas de fechamento — Núcleo Social ORVOK V1

Data: 2026-09-22  
Escopo: auditoria documental e técnica do bloco Núcleo Social V1.  
Auditor: agente independente de arquitetura, segurança, privacidade e rastreabilidade.

## Conclusão executiva

O estado atual é uma fundação Radar `TEST_ONLY` validada para contas de teste. O schema, as migrações e as rotas cobrem identidade, convites, consentimento, respostas, snapshots, direitos do titular, notificações operacionais e auditoria. Não existem ainda entidades, serviços, rotas ou telas para perfil social, grupos, feed, comentários, reações, mensagens, denúncias, bloqueios, eventos do mundo ou Command Center administrativo.

O bloco solicitado pode avançar como implementação controlada, mas não pode ser declarado pronto para usuários reais. As perguntas e o aviso abaixo são propostas candidatas; não devem ser importados como `APPROVED`. A revisão jurídica e a aprovação formal de resolução continuam pré-condições de operação.

## Inventário e evidências verificadas

Foram lidos o schema Prisma, contratos operacionais, contratos Radar `TEST_ONLY`, gates de homologação, rastreabilidade, README, componentes e rotas existentes, testes unitários, integração e E2E, além das migrações presentes.

Evidências principais:

| Severidade | Achado | Evidência | Correção necessária | Teste de aceite |
|---|---|---|---|---|
| Alta | O núcleo social pedido não existe no modelo de dados. | `prisma/schema.prisma`: não há `Profile`, `Group`, `GroupMember`, `FeedItem`, `Comment`, `Reaction`, `Report`, `Block` ou `Message`. | Criar modelos append-only onde histórico importa, FKs compostas para escopo do usuário e RLS por papel/relacionamento. | Migração limpa e incremental; teste de autorização A/B/C para cada entidade. |
| Alta | Não há ciclo de evento/oportunidade do mundo implementado. | `PredictionEvent` e `PredictionSnapshot` existem estruturalmente, sem serviço/rota de criação, congelamento ou resolução. | Criar estados e transições explícitos, sem calcular Score/Brier. | Testar evento → oportunidade → previsão → congelamento → resolução de teste; rejeitar transições fora de ordem e replay. |
| Alta | Não há Command Center implementado. | `src/app/api/v1/[[...path]]/route.ts` expõe apenas operações de identidade, Radar e direitos; não há rotas de suspensão, denúncias, grupos ou eventos. | Criar RBAC backend, motivo obrigatório, idempotência e `AuditLog` para cada ação administrativa. | Matriz de autorização e testes de usuário, moderador e administrador. |
| Alta | O catálogo oficial continua deliberadamente bloqueado. | `docs/CONTRATOS_RADAR_SOCIAL_TEST_ONLY_V1.md` e `fixtures/radar-catalog-test-only.json`. | Manter propostas fora do seed; só promover após aprovação formal, manifesto e hashes. | Importador recusa `APPROVED` sem decisão e rejeita 11/13 itens. |
| Alta | A retenção/exclusão ainda é provisória. | `DataRequest` registra pedido; contratos dizem que não há eliminação automática. | Submeter política abaixo à revisão jurídica; depois implementar job versionado e prova de conclusão. | Testar acesso, exportação, pedido, retenção, backup e reconciliação jurídica. |
| Média | Semântica de match, notificação e resolução ainda não está ratificada. | `docs/RADAR_V1_GATES_DE_HOMOLOGACAO.md` lista essas pendências. | Ratificar contrato antes de expor qualquer interpretação como regra de produto. | Fixtures de reciprocidade e testes de não vazamento. |
| Média | Não há remoto Git configurado no estado auditado. | `git remote -v` vazio no bloco anterior. | Configurar remoto e executar CI hospedado com evidência observável antes de usuários reais. | Build, migrations, testes, E2E e artefatos no CI remoto. |
| Média | O dashboard Radar é deliberadamente limitado a 20 itens e `hasMore`, sem cursor próprio. | `docs/CONTRATOS_RADAR_SOCIAL_TEST_ONLY_V1.md`. | Para o núcleo social, usar cursores por coleção ou declarar o limite como definitivo para homologação. | Testar paginação, ordenação estável e ausência de duplicatas. |

## Proposta candidata das 12 perguntas Radar

Esta tabela é uma proposta de redação, não um catálogo oficial. Deve passar por revisão de linguagem, teste cognitivo, análise de dependência/família, LGPD e decisão formal. Todas usam escala ordinal de cinco opções: `1 Muito improvável`, `2 Improvável`, `3 Incerto`, `4 Provável`, `5 Muito provável`. O participante deve poder escolher `Não tenho informação suficiente`, que fica fora de qualquer cálculo futuro e deve ser preservado como resposta explícita.

| ID candidato | Texto proposto | Janela de referência | Família | Critério de não diagnóstico |
|---|---|---|---|---|
| RH-C01 | Quando precisa decidir algo importante, esta pessoa costuma buscar informação adicional antes de agir? | últimos 12 meses | decisão | comportamento observável; não mede transtorno |
| RH-C02 | Quando recebe uma informação nova que contraria sua expectativa, esta pessoa costuma reconsiderar sua posição? | últimos 12 meses | atualização | não rotula personalidade |
| RH-C03 | Quando assume um compromisso, esta pessoa tende a cumpri-lo no prazo combinado? | últimos 12 meses | compromisso | não presume causa ou caráter |
| RH-C04 | Quando percebe um erro próprio, esta pessoa tende a reconhecê-lo e corrigi-lo? | últimos 12 meses | correção | sem inferência clínica |
| RH-C05 | Em uma conversa difícil, esta pessoa tende a ouvir a outra perspectiva antes de responder? | últimos 12 meses | diálogo | comportamento situado |
| RH-C06 | Quando há desacordo em um grupo, esta pessoa tende a procurar uma solução aceitável para os envolvidos? | últimos 12 meses | cooperação | não classifica habilidade social |
| RH-C07 | Quando uma tarefa tem várias etapas, esta pessoa tende a acompanhar o que ainda precisa ser feito? | últimos 12 meses | organização | sem diagnóstico de atenção |
| RH-C08 | Quando os planos mudam inesperadamente, esta pessoa tende a ajustar o próximo passo sem abandonar o objetivo? | últimos 12 meses | adaptação | não usa linguagem de saúde |
| RH-C09 | Ao fazer uma previsão ou estimativa, esta pessoa tende a declarar o quanto está incerta? | últimos 12 meses | incerteza | mede prática declarada, não competência matemática |
| RH-C10 | Quando dispõe de evidência relevante, esta pessoa tende a usá-la para justificar uma conclusão? | últimos 12 meses | evidência | não afirma racionalidade global |
| RH-C11 | Quando outra pessoa precisa de ajuda dentro de um compromisso combinado, esta pessoa tende a responder em tempo razoável? | últimos 12 meses | reciprocidade | janela e contexto explícitos |
| RH-C12 | Ao receber uma crítica específica e respeitosa, esta pessoa tende a considerar uma mudança concreta? | últimos 12 meses | aprendizado | não mede traço clínico |

Requisitos de aprovação: texto final, ordem, opções, janela, família, finalidade, versão do instrumento, manifesto de IDs e hashes; teste com participantes; revisão de vieses e linguagem; confirmação de que nenhum item produz inferência clínica/diagnóstica; aprovação expressa do produto e governança. Até isso ocorrer, `QuestionVersion.catalogStatus` deve permanecer `TEST_ONLY` ou `CANDIDATE`.

## Proposta de aviso final de consentimento

Texto candidato para revisão jurídica e de produto:

> Você está autorizando o ORVOK a registrar suas respostas ao instrumento Radar e, neste convite específico, a permitir que **[nome do previsor]** registre uma previsão sobre suas respostas. A previsão será armazenada como um snapshot versionado, com data, versão do instrumento e versão deste aviso. O previsor não verá suas respostas ou o gabarito antes do momento previsto nas regras do Radar. Você pode revogar este consentimento para impedir novas previsões e limitar a exposição futura, sem apagar automaticamente registros que precisem ser preservados para segurança, auditoria ou obrigações legais. Você pode solicitar acesso, exportação e exclusão pelos canais do ORVOK. O Radar não é diagnóstico clínico, não mede saúde mental e não deve ser usado para decisões de crédito, emprego, seguro ou outros efeitos legais. Leia o aviso completo, confirme que entendeu a finalidade e escolha “Concordo” ou “Não concordo”.

Contrato de apresentação: `purpose=SELF_ANSWER` para respostas próprias e `purpose=BE_PREDICTED` para a relação do convite; o texto, hash, versão, sessão, aceite e timestamp ficam imutáveis. “Concordo” não deve ser pré-marcado. Recusar deve manter convite e direitos do titular acessíveis, sem criar grant.

## Contrato de resolução e avaliação — proposta V1 estrutural

Para previsões sobre o mundo, cada `PredictionEvent` deve ter `DRAFT → OPEN → FROZEN → RESOLVED → REVIEWED` ou `CANCELLED`. `OPEN` aceita previsões até `closesAt`; `FROZEN` encerra entradas; `RESOLVED` registra uma fonte e evidência; `REVIEWED` registra revisão/aprovação. Cancelamento exige motivo, ator autorizado e trilha. Nenhum estado calcula Score.

Para o Radar Humano, a ordem canônica permanece convite → aceite → aviso/consentimento → gabarito próprio e do alvo → previsão → snapshot. Uma resposta posterior não reescreve o snapshot. A expressão “avaliar quando o alvo responder” deve ser interpretada apenas como elegibilidade de avaliação futura quando houver contrato ratificado; não autoriza previsão sem gabarito nem revela resposta antecipadamente.

Contrato mínimo de resolução: `resolutionSource`, `resolutionRule`, `resolvedAt`, `evidenceRefHash`, `resolvedBy`, `version`; fonte e regra são obrigatórias, referência privada é hash/URI controlada, e toda alteração gera nova versão. Testes: fechamento fora da janela rejeitado; duas resoluções concorrentes serializadas; cancelamento sem motivo rejeitado; replay idempotente; histórico imutável.

## Política operacional de revisão, correção e cancelamento — proposta

Usuário pode contestar convite, aviso, resposta própria, previsão própria, evento e resolução por solicitação autenticada. A contestação recebe `OPEN`, `UNDER_REVIEW`, `ACCEPTED`, `REJECTED`, `CANCELLED`, com prazo operacional a definir juridicamente, motivo obrigatório e auditoria. Correção de texto/metadado permitido somente por nova versão; não atualizar snapshots ou respostas históricas. Correção de erro de sistema exige incidente, migração versionada e recomputação futura sem apagar o original. Cancelamento de evento impede novas previsões, preserva o histórico e exibe “CANCELLED”; não transforma Score em zero. Administrador e moderador não podem alterar conteúdo sem motivo e escopo autorizado.

Testes: titular só contesta seus objetos; moderador não resolve sua própria ação; administrador sem motivo é rejeitado; revisão concorrente é idempotente; snapshot e log não sofrem `UPDATE`/`DELETE` direto.

## Retenção e exclusão — proposta técnica provisória para revisão jurídica

Até a decisão jurídica, conservar dados brutos, snapshots, consentimentos, revogações, auditoria e pedidos de direitos pelo período mínimo necessário para segurança, contestação, integridade e prestação de contas; não publicar prazo como política final. Separar retenção por classe: identidade/sessão, conteúdo e respostas, snapshots, auditoria, pedidos de direitos, notificações e backups. Cada classe precisa de `retentionPolicyVersion`, base/finalidade, prazo, método de eliminação/anonimização e exceção legal.

Pedido de exclusão deve ser recebido, autenticado, classificado, suspenso quando houver preservação legal/incidente e concluído por job auditado. Eliminação deve apagar ou anonimizar identificadores e conteúdo conforme parecer jurídico; snapshots necessários à integridade podem ser mantidos com pseudonimização e acesso restrito. Backups seguem ciclo próprio e não devem ser prometidos como apagados imediatamente; a restauração deve reaplicar a política. Exportação deve incluir dados do titular em formato estruturado, sem dados de terceiros.

Itens para o parecer: base legal por finalidade, prazos, anonimização, backups, litígio, menores, subcontratados, transferências internacionais e canal de atendimento. Esta proposta não autoriza operação comercial.

## Estratégia de homologação com usuários de teste

Usar contas sintéticas verificadas, banco isolado e catálogo/avisos `TEST_ONLY`. Dividir em quatro ciclos: (1) identidade e direitos; (2) Radar e reciprocidade; (3) grupos/feed/moderação; (4) mundo/eventos e administração. Cada ciclo tem roteiro, dados sem PII real, consentimento de teste, evidência de logs, gravação de versão e critérios de saída.

Critérios de bloqueio: qualquer leitura cruzada; bypass de consentimento; vazamento de gabarito; operação administrativa sem motivo/auditoria; migração ou restauração inconsistente; segredo em log; falha crítica de acessibilidade; qualquer pergunta não aprovada publicada. A homologação não mede Score nem valida inferências matemáticas. O relatório deve separar defeito técnico, problema de usabilidade e decisão de produto.

## Auditoria de arquitetura, segurança, LGPD e testes

1. O boundary de leitura e os RPCs Radar são bons controles de fundação, mas novas entidades sociais devem nascer já com RLS, políticas de objeto e testes de leitura cruzada; não reutilizar somente o padrão do frontend.
2. O papel administrativo técnico usado pelo seed não é uma identidade operacional. O Command Center precisa de autenticação forte, MFA ou controle equivalente, sessão curta, reautorização para ações sensíveis e segregação entre moderador e administrador.
3. Comentários, mensagens, denúncias e fotos introduzem conteúdo pessoal e potencialmente sensível. O schema deve prever minimização, classificação, limites de tamanho, sanitização, anexos fora do banco, varredura, abuso e remoção sem apagar o log necessário.
4. Bloqueio deve prevalecer sobre reciprocidade, match, feed, convite, mensagem e exposição histórica futura. A consulta precisa testar os dois sentidos (A bloqueia B e B bloqueia A) e corrida entre leitura e bloqueio.
5. Notificações devem carregar apenas tipo, objeto e estado; não incluir resposta, probabilidade, gabarito ou conteúdo privado em payload, logs ou previews.
6. Jobs de retenção, exportação, moderação e notificações devem ser idempotentes, observáveis, com retry limitado e fila/outbox transacional. Falha parcial deve deixar estado recuperável.
7. Todos os contratos novos precisam de schemas de entrada/saída, erros, autorização, idempotência, paginação e E2E. O frontend não pode ser a única barreira.
8. A suíte atual comprova principalmente invariantes Radar. Ela não cobre os domínios novos; portanto a conclusão do bloco deve incluir testes positivos, negativos, concorrentes, migração incremental, backup/restauração, acessibilidade e mobile para cada novo domínio.

## Rastreabilidade proposta

| Requisito | Origem | Entrega candidata | Estado |
|---|---|---|---|
| RH-SOC-01 | REV02 canônica / M55 | catálogo versionado, 12 itens aprovados por decisão separada | bloqueado |
| RH-SOC-02 | REV02 / contratos Radar | aviso por finalidade, hash, apresentação vinculada | proposta; `TEST_ONLY` existente |
| RH-SOC-03 | Motor Matemático V1 / M55 | estados de evento e resolução sem Score | pendente de implementação |
| RH-SOC-04 | LGPD provisória / Gate | revisão, correção, cancelamento, direitos | proposta jurídica |
| RH-SOC-05 | Arquitetura técnica | perfil, grupos, feed, mensagens, moderação | não implementado |
| RH-SOC-06 | Governança | ações administrativas autorizadas e auditadas | não implementado |
| RH-SOC-07 | Operação | homologação isolada, backup, CI remoto | parcial; remoto ausente |

## Recomendação formal

Prosseguir com implementação somente em ambiente de teste e em fatias que mantenham as barreiras Radar existentes. Não autorizar usuários reais, publicação de perguntas, aviso `APPROVED`, scoring, reputação matemática ou operação comercial até as decisões propostas serem aprovadas, a revisão jurídica ser concluída e o CI/infraestrutura hospedada fornecer evidência observável.

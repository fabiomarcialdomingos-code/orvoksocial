# Rastreabilidade inicial — Fase 0

## Refinamento RHV1 — Radar Humano Social V1 (escopo de teste)

Os itens RHV1 refinam os grupos R01–R43 e não mudam a contagem de 43 grupos. A matriz registra a autorização do bloco Radar V1, sem transformar regras candidatas em decisões oficiais. A evidência de conclusão será registrada no relatório final do bloco.

| ID | Grupos R | Origem | Contrato e entrega | Teste de aceite | Estado |
| --- | --- | --- | --- | --- | --- |
| RHV1-01 | R02/R04/R05/R40 | Produto 01 §3; M52; V2 canônica §5; autorização atual | catálogo Radar versionado, importação controlada e fixtures `TEST_ONLY`; publicação oficial bloqueada | recusar pergunta não ratificada em ambiente real; integridade de versão/opções; manifesto incompleto ou alterado | Implementado para teste; 12 perguntas oficiais pendentes |
| RHV1-02 | R28/R30/R31 | Produto 01 §3; M55 §55.8.5; V2 canônica §§5–6 | convite→aceite→aviso→grant→gabarito→previsão, com snapshot imutável e versão do consentimento | casos positivos, recusas temporais, revogação, concorrência e bypass de SQL | Verificado localmente; avaliação pós-resolução pendente |
| RHV1-03 | R28/R29/R32 | M52 §52.18; V2 canônica §§5–6; autorização atual | projeções de previsões feitas/sobre o titular e reciprocidade estrutural, sem métricas | leitura cruzada proibida; revogação oculta exposição futura; gabarito não vaza | Verificado localmente; semântica final de match pendente |
| RHV1-04 | R42 | Produto 01 §§5–6; decisão D13 candidata; autorização atual | inbox Radar com eventos operacionais mínimos, referências e deduplicação | destinatário exclusivo; retry, revogação e ausência de conteúdo sensível | Verificado localmente; canais/gatilhos finais pendentes |
| RHV1-05 | R29/R30/R43 | política LGPD técnica provisória; autorização atual | exportação própria, solicitação de exclusão, auditoria e backup/restauração | autorização e limites da exportação, trilha e restauração | Fluxo técnico existente; revisão jurídica pendente |
| RHV1-06 | R01/R41/R43 | sistema visual REV02; autorização atual | telas Radar para teste, estados de UI, responsividade e acessibilidade | E2E, teclado, foco, larguras móveis e desktop | Verificado localmente em 22 E2E; auditoria assistiva humana pendente |

**Conflito de ordem temporal:** o pedido atual menciona avaliação quando o alvo responder, enquanto V2 canônica §§5–6 exige gabarito válido antes da previsão e resultado/avaliação depois. Nenhum contrato autoriza previsão sem gabarito ou reavaliação retroativa por resposta posterior. Esta parte da experiência permanece bloqueada até decisão formal compatível; os demais fluxos seguem a ordem canônica.

## Refinamento FOP — fundação operacional autorizada em 22/09/2026

Estes IDs refinam os 43 grupos R01–R43; não criam 11 requisitos de produto adicionais. Estado “implementado” aqui se refere apenas à infraestrutura e aos contratos para testes controlados. Critérios de abertura ao público permanecem separados.

| ID | Grupos R | Origem | Entrega | Evidência/aceite | Estado |
| --- | --- | --- | --- | --- | --- |
| FOP-01 | R27/R41/R43 | arquitetura REV01; autorização do bloco | cadastro, login, verificação, recuperação, sessões, rotação e revogação | testes de auth, SMTP fake, cookies e abuso | Implementado para teste |
| FOP-02 | R28/R29/R41 | M55; V2 canônica; matriz D11 | acesso por ator/objeto, papéis DB separados e RLS por sessão | testes horizontais, SQL direto negado, leitura cruzada e bypass de RPC negados | Verificado localmente |
| FOP-03 | R28–R33 | M52/M55; V2 canônica; F1C | convite→aceite→aviso→consentimento→gabarito→previsão; revogação e snapshots imutáveis | testes serviço, API, banco, concorrência e ordem temporal | Verificado localmente |
| FOP-04 | R28/R30 | M54; política provisória | apresentação e hash/versionamento exatos do aviso; catálogo oficial vazio | ausência de aviso retorna indisponível; mismatch bloqueado | Infraestrutura implementada; conteúdo oficial pendente |
| FOP-05 | R29/R30/R43 | política técnica provisória; autorização | exportação própria e pedido de exclusão auditado | teste de autorização, limite do stream e registro do pedido | Técnico; revisão jurídica pendente |
| FOP-06 | R41 | arquitetura REV01; D12 | `/api/v1` versionado, schemas, erros, idempotência e paginação | testes de contrato e replay | Implementado para teste |
| FOP-07 | R42 | arquitetura REV01; D13 | inbox com estados, sem gatilhos de produto inventados | somente titular lê; paginação | Infraestrutura implementada |
| FOP-08 | R01/R41 | sistema visual REV02 | tokens, componentes e telas-base de identidade/convite/consentimento | E2E, seis larguras, teclado/foco | Implementado para teste |
| FOP-09 | R43 | arquitetura/Blueprint REV01 | CI PostgreSQL, lint, typecheck, testes, build e migração regressiva | comandos locais verdes; CI remoto ainda não executado | Verificado localmente |
| FOP-10 | R28/R43 | M54; ADR-002 | logs, auditoria de ações e bloqueios, segredo fora do Git | testes de auditoria, RLS e revisão de logs | Verificado localmente |
| FOP-11 | R43 | Blueprint; autorização | runbook, separação owner/runtime, backup/restauração ensaiados | `pg_dump`/`pg_restore` em banco isolado; 16 migrações e contagens de usuários/grants iguais | Verificado localmente; política de retenção pendente |

As decisões canônicas de estados continuam Radar `0–43 INITIAL`, `≥44 EVALUATION`, `≥90 + R_A/R_B≥10 + IC95%(γ)` para `SUFFICIENT`; mundo `0 INITIAL`, `1–96 EVALUATION`, `≥97 SUFFICIENT`. Este bloco **não calcula** tais estados, Score, consenso, RadarScore, γ ou reputação. O campo estrutural de estado só guarda a classificação futura versionada.

## Refinamento F1C — consentimento e ordem temporal autorizado em 22/09/2026

| ID     | Grupos R    | Origem                                                | Entrega                                           | Teste futuro/aceite                                           | Estado                |
| ------ | ----------- | ----------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- | --------------------- |
| F1C-01 | R28/R29/R30 | 01 §3; M55 §55.8.5; V2 canônica §6; autorização atual | convite, aceite, grant Radar versionado           | ordem convite→aceite→grant; ausência de aceite bloqueia       | Verificado localmente |
| F1C-02 | R05/R28/R31 | M52 §52.18; 08 §2; V2 canônica §5–6                   | versão no snapshot, trigger temporal, append-only | gabarito anterior ao Radar; versão fixa; UPDATE bloqueado     | Verificado localmente |
| F1C-03 | R28/R32     | M55 §55.8.5; autorização atual                        | revogação serializada e auditoria                 | previsão/avaliação recusadas após revogação; logs persistidos | Verificado localmente |
| F1C-04 | R31/R33     | 01 §3; autorização atual                              | validador de desfecho posterior                   | previsão < resultado, igualdade e inversão recusadas          | Verificado localmente |

F1C-01–04 refinam R01–R43, sem mudar a contagem de 43 grupos. Detalhes e limites no [relatório dos invariantes](FASE_1_INVARIANTES_CONSENTIMENTO_TEMPO.md). Fase 1 permanece parcial.

A matriz completa R01–R43, com origem, prioridade, módulo, dados, teste futuro e estado, está em [`ORVOK_DIAGNOSTICO_PRE_IMPLEMENTACAO_V1.md`](../ORVOK_DIAGNOSTICO_PRE_IMPLEMENTACAO_V1.md). Os 43 IDs são grupos de requisitos, não contagem de regras atômicas. Não há matriz anterior verificável no novo repositório.

| ID técnico | Origem              | Entrega da Fase 0                       | Evidência exigida                   | Estado                        |
| ---------- | ------------------- | --------------------------------------- | ----------------------------------- | ----------------------------- |
| F0-01      | 09 §3; 10 §6; 11 §5 | Stack, versões e lockfile               | instalação congelada e build        | Verificado localmente         |
| F0-02      | 09 §§4–5,27–28      | Estrutura, ambientes e migrations       | validação Prisma e `migrate deploy` | Verificado localmente         |
| F0-03      | 09 §§23–24; 10 §29  | Segredos ignorados e PostgreSQL isolado | `git check-ignore`, conexão e smoke | Verificado localmente         |
| F0-04      | 09 §§25,30; 10 §22  | Lint, typecheck, Vitest e Playwright    | comandos verdes; smoke HTTP/DB      | Verificado localmente         |
| F0-05      | 10 §§23,27; 11 §9   | CI, hooks, ADR e relatório              | CI YAML, commit identificável       | Preparado; commit ao encerrar |

IDs de produto R01–R43 permanecem sem implementação nesta fase. D1, D2 e L1–L6 não são resolvidos por F0-01–F0-05.

Após a Fase 0, uma referência adicional foi encontrada. A análise inicial está em [`RELEITURA_REFERENCIAS_ADENDO_V1.md`](RELEITURA_REFERENCIAS_ADENDO_V1.md). A reconciliação A01–A11, com proposta, conflito, decisão, impacto, teste e status, está na [`matriz V2`](../MATRIZ_ADENDO_A01_A11_V2.md), subordinada à [`hierarquia REV02`](../ORVOK_HIERARQUIA_DOCUMENTAL_REV02.md) e ao [`fechamento V2`](../ORVOK_FECHAMENTO_LACUNAS_MATEMATICA_LGPD_CONTRATOS_V2.md). São 11 registros de adendo relacionados aos 43 grupos R01–R43, não 54 requisitos aprovados. Fase 1 bloqueada até validação formal da V2 e resolução dos contratos aplicáveis.

> **Canonização posterior (22/09/2026):** a decisão formal do produto ratificou a [`V2 canônica`](../ORVOK_FECHAMENTO_LACUNAS_MATEMATICA_LGPD_CONTRATOS_V2_CANONICA.md) e tornou obsoletos a V2 externa acima e o ZIP divergente. O parágrafo anterior é histórico. Valem Radar `0–43 INITIAL`, `≥44 EVALUATION` até `≥90 + R_A/R_B≥10 + IC95%(γ)` para `SUFFICIENT`; mundo `0 INITIAL`, `1–96 EVALUATION`, `≥97 SUFFICIENT`. O efeito relacional usa exclusivamente `γ_ij`.

| ID estrutural | Rastreia        | Entrega autorizada                                         | Evidência de aceite                                     | Estado                                |
| ------------- | --------------- | ---------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| F1S-01        | R02/R04/R05/R40 | Question/QuestionVersion/AnswerOption, catálogo real vazio | unicidade, FK opção×versão, fixture com rollback        | Preparado; teste de DB                |
| F1S-02        | R28/R29/R30     | ConsentGrant/ConsentRevocation por finalidade e titular    | FK composta, revogação única, sem purge                 | Preparado; contrato jurídico pendente |
| F1S-03        | R05/R31         | AnswerVersion e snapshots mundial/social imutáveis         | FK de gabarito/alvo/previsor/versão, trigger sem UPDATE | Preparado; fluxo/API posterior        |
| F1S-04        | R32/R33         | AuditLog e EvidenceAssessment com enum oficial             | três estados, trilha append-only                        | Preparado; nenhum cálculo autorizado  |

Esta é **preparação parcial da Fase 1**, não conclusão da fase inteira do Blueprint. Scoring, consenso, RadarScore, γ, shrinkage, ranking e telas continuam sem autorização. A política LGPD segue técnica provisória e o catálogo das 12 perguntas ainda não foi fornecido.

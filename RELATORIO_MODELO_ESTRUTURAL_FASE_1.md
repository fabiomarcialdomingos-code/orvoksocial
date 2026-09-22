# ORVOK — relatório da preparação estrutural da Fase 1

> **Atualização posterior:** os invariantes de consentimento e ordem temporal foram implementados sob autorização específica. Evidências e limites estão em [`docs/FASE_1_INVARIANTES_CONSENTIMENTO_TEMPO.md`](docs/FASE_1_INVARIANTES_CONSENTIMENTO_TEMPO.md). A descrição abaixo retrata a preparação estrutural anterior e não encerra a Fase 1.

**Estado:** preparação parcial autorizada, **não Fase 1 concluída**. Data: 22/09/2026. Fontes: decisão de canonização, 00/01/03/M52–M55/08–11, V2 canônica e `docs/CONTRATOS_DADOS_FASE_1_ESTRUTURAL.md`. Nenhum serviço de produto, endpoint, tela ou cálculo foi implementado.

## Alterações e razão

`prisma/schema.prisma` passou da fundação sem modelos de produto para **estrutura vazia** de User, Question, QuestionVersion, AnswerOption, ConsentGrant, ConsentRevocation, AnswerVersion, PredictionEvent, PredictionSnapshot, SocialPredictionSnapshot, AuditLog e EvidenceAssessment. O enum de evidência tem somente `INITIAL`, `EVALUATION`, `SUFFICIENT`. A migração `20260922010000_structural_data/migration.sql` cria tabelas, FKs compostas, índices, checks básicos e triggers que rejeitam UPDATE em registros históricos. `AnswerVersion` é resposta própria versionada; a previsão social aponta para a versão do gabarito do alvo e a resposta própria do previsor, sem copiá-las para um resultado derivado. As FKs compostas ligam opção à versão da pergunta, gabarito ao alvo/pergunta, resposta própria ao previsor/pergunta, consentimento ao alvo e evento à versão de pergunta.

O catálogo de produção está **vazio**; `prisma/seed.ts` continua sem dados. O teste de integração usa IDs/textos `fixture` numa transação com `ROLLBACK`. `src/app` e demais telas existentes da fundação não foram alterados; não há telas novas. Não foram criadas tabelas de Score, consenso, RadarScore, γ, shrinkage ou ranking.

## Evidência executada

| Verificação                                 | Resultado                                                                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `prisma format` e `prisma validate`         | schema válido                                                                                                               |
| `prisma migrate deploy` no PostgreSQL local | migração estrutural aplicada; 2 migrations totais                                                                           |
| `prisma migrate status`                     | schema do banco atualizado                                                                                                  |
| Teste de integração estrutural              | passou: três enums, FK opção×versão, alvo/previsor/consentimento, revogação única e rejeição de UPDATE; fixtures revertidas |
| Suíte Vitest                                | 2 arquivos, 3 testes passaram                                                                                               |
| ESLint e TypeScript                         | sem erros                                                                                                                   |
| Build Next.js                               | aprovado; apenas rotas de fundação `/` e `/_not-found`                                                                      |
| Smoke PostgreSQL                            | PostgreSQL 18.6; 2 migrations aplicadas                                                                                     |

Os comandos Vitest, Next build e Prisma migrate encontraram `spawn EPERM` dentro do sandbox Windows; foram repetidos com autorização de execução externa e passaram. Os testes novos são de integridade estrutural real, não comparação de implementação consigo mesma. Nenhum teste de scoring, Radar ou produto foi declarado executado.

## Inspeção de riscos por eixo

| Eixo                      | Achado e severidade                                                                                                   | Condição antes da função afetada                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Arquitetura               | Apenas camada de dados; sem lógica de domínio no frontend. Baixo                                                      | Criar serviços separados em fase autorizada                         |
| Banco/migrações           | FKs compostas e trigger UPDATE conferidos. Médio: DELETE não foi bloqueado para não presumir política LGPD            | Aprovar direitos/retenção antes de dados reais; testar erase/backup |
| Fórmulas                  | Nenhuma implementada. Bloqueio intencional                                                                            | Contrato matemático versionado futuro                               |
| Segurança/autorização     | Schema não implementa sessão/RBAC nem bloqueio de consentimento revogado. Alto para qualquer uso real                 | Serviço transacional de autorização e testes negativos              |
| Privacidade/LGPD          | Retenção/exclusão são provisórias. Alto para operação comercial                                                       | Revisão jurídica e política por finalidade/base/prazo               |
| API/contratos             | Nenhum endpoint adicionado; contrato estrutural documentado. Baixo agora                                              | OpenAPI/autorização antes de expor dados                            |
| Frontend/acessibilidade   | Nenhuma tela alterada. Não aplicável nesta entrega                                                                    | Inspeção na fase de UI                                              |
| Responsividade/desempenho | Nenhuma UI; índices básicos presentes, sem carga. Médio                                                               | Teste de volume antes de produção                                   |
| Testes/cobertura          | Integração cobre invariantes centrais; temporalidade e purpose de consentimento não são garantidos pelo schema. Médio | Testes de serviço e concorrência posteriores                        |
| Observabilidade/auditoria | AuditLog estrutural e imutável; geração automática ainda ausente. Médio                                               | Serviço de auditoria antes de ações críticas                        |
| Aderência documental      | Limiares oficiais e γ canônicos; catálogo vazio. Baixo                                                                | Não usar documentos obsoletos                                       |
| Produção                  | Estrutura local apenas; nenhuma prontidão de produto. Alto                                                            | Gates completos das fases futuras                                   |

**Limites importantes:** a FK não prova que `ConsentGrant.purpose` é o correto, que o grant ainda estava ativo em `predictedAt`, que `answeredAt≤predictedAt`, que um item não foi revelado antes, nem que um vetor de probabilidade soma 1. Essas são validações de serviço e autorização **não autorizadas para implementação agora**; até existirem, não gravar previsões reais por API. `EvidenceAssessment` é tabela estrutural vazia, não publicação de métrica. A revogação é evento registrado, sem rotina de supressão ainda. A Fase 1 completa do Blueprint continua dependente de autorização e decisões adicionais.

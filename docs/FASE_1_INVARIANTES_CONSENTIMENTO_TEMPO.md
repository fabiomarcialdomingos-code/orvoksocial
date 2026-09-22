# ORVOK — invariantes de consentimento e ordem temporal da Fase 1

> **Atualização posterior:** este relatório registra a entrega parcial original. O bloco operacional acrescenta APIs, papéis SQL restritos, apresentação vinculada à sessão, verificação de hash/versão do aviso e bloqueio de grants legados sem apresentação; consulte [`ADR-002-fundacao-operacional.md`](ADR-002-fundacao-operacional.md) e o relatório final do bloco. As declarações abaixo sobre ausência de API e migrações apenas iniciais são históricas.

**Estado:** entrega parcial autorizada em 22/09/2026; Fase 1 ainda não concluída. Fontes: 01 §3, M52 §52.18, M55 §55.8.5, Modelo de Dados 08 §2, V2 canônica §§5–6 e decisão atual do produto. M55 e Motor Matemático V1 não foram alterados.

## Contrato implementado

No Radar, a ordem estrita é convite → aceite do alvo → consentimento `BE_PREDICTED` → gabarito do alvo → previsão social. A regra de previsão anterior ao gabarito vale só para fluxos cujo desfecho é posterior; por ora existe apenas um validador puro dessa ordem, sem serviço de previsões de mundo. Aceite não equivale a consentimento. `SELF_ANSWER` e `BE_PREDICTED` são finalidades distintas.

`RadarInvitation` e `RadarInvitationAcceptance` são eventos separados e imutáveis. O grant Radar aponta para aceite do mesmo titular e guarda `consentVersion` positiva, `noticeVersion` e hash do aviso. A versão cresce por titular/finalidade; grants legados não são ligados silenciosamente a convites novos. O snapshot guarda `targetConsentGrantId` e `targetConsentVersion` por FK composta. Um snapshot exige o previsor do convite, alvo do aceite/grant, grant não revogado, gabarito e resposta própria anteriores à previsão. `UPDATE` continua proibido.

`RadarConsentService` transaciona convite, aceite, concessão, revogação e snapshot. Previsão e revogação bloqueiam a mesma linha do grant para serializar a corrida. O serviço resolve internamente a versão mais recente do gabarito do alvo; o chamador não fornece seu ID nem recebe o gabarito. `assertEvaluationEligible` só responde se o consentimento atual permite avaliar o snapshot; **não calcula nem publica** avaliação, Score, consenso ou RadarScore. Cada concessão/revogação grava auditoria na transação de sucesso; recusa de negócio grava `*_BLOCKED_<motivo>` em transação própria após rollback, sem vetor ou gabarito no log.

## Necessidade de SQL além do serviço

Sim. FKs compostas fixam titular e versão; unicidade impede aceite e versão duplicados; triggers barram aceite antes do convite, consentimento antes do aceite, revogação retroativa, snapshot sem grant Radar ativo, cadeia temporal inválida e UPDATE histórico. Sem a barreira SQL, um escritor direto contornaria o serviço. Uma transação SQL abortada não persiste auditoria de seu próprio bloqueio; a futura API deverá chamar o serviço e o papel de aplicação não deverá receber DML direto nas tabelas protegidas. Entrada inválida sem identidade autenticada dependerá da futura camada de autenticação e observabilidade.

## Verificação

| Caso                               | Evidência                                                            |
| ---------------------------------- | -------------------------------------------------------------------- |
| Sem aceite ou consentimento        | integração de serviço e trigger de grant                             |
| Pós-revogação                      | integração de submissão, elegibilidade e insert SQL direto           |
| Versão no snapshot                 | leitura do snapshot e FK composta                                    |
| Ordem estrita e desfecho posterior | unitários e rejeições SQL de datas invertidas                        |
| Snapshot imutável                  | trigger UPDATE testado                                               |
| Auditoria                          | concessão, revogação e recusas de serviço testadas                   |
| Migração incremental               | `migrate deploy` local e verificador isolado com dois grants legados |
| Migração limpa                     | verificador isolado aplicando as três migrações                      |
| Lint, typecheck e testes           | passaram; Vitest: 4 arquivos, 8 testes                               |
| Build                              | passou com rotas de fundação `/` e `/_not-found`                     |

Não há API pública, sessão, controle fino de acesso, catálogo das 12 perguntas, mecanismo de revelação de gabarito ou operação com dados reais. Portanto, a ausência de vazamento por interface não é verificável nesta entrega. A política LGPD permanece técnica provisória e sujeita a revisão jurídica antes de operação comercial. Não foram criados critérios de retenção ou eliminação. Qualquer avanço da Fase 1 exige nova autorização.

## Inspeção técnica da entrega parcial

| Eixo                            | Achado / severidade                                                                                            | Evidência / encaminhamento                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Arquitetura e contratos         | Serviço sem endpoint; baixo para esta entrega                                                                  | lógica no backend; nenhuma tela ou rota de produto                                      |
| Banco e migrações               | Integridade temporal depende também de trigger; resolvido                                                      | inserções SQL inválidas rejeitadas; migrações limpa e incremental verificadas           |
| Regras e fórmulas               | Nenhum cálculo implementado; conforme escopo                                                                   | inspeção do diff e testes sem módulos de métrica                                        |
| Segurança e autorização         | Autenticação e restrição de DML direto ausentes; alto antes de tráfego real                                    | não expor o serviço; definir identidade, papéis e privilégios em fase futura            |
| Privacidade e LGPD              | Hash/versão do aviso são registrados, mas não provam exibição efetiva do texto; alto antes de dados reais      | exigir fluxo de consentimento aprovado e revisão jurídica; política continua provisória |
| APIs, frontend e acessibilidade | Nenhum endpoint/tela novo; não aplicável                                                                       | inspeção quando esses fluxos forem autorizados                                          |
| Desempenho                      | Índices e locks funcionais; carga/concorrência de produção ainda não medida; médio                             | ensaio de corrida e volume antes de produção                                            |
| Testes e auditoria              | Casos permitidos/proibidos e auditoria de recusas do serviço passaram; direto SQL abortado não gera log; médio | futuro papel de aplicação sem DML direto e auditoria na camada de entrada               |
| Observabilidade e produção      | Sem métricas operacionais da jornada; alto para operação real                                                  | fase futura de API/monitoramento, sem declarar prontidão                                |

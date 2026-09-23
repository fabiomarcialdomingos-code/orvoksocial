# Orquestração automática do Motor Matemático ORVOK V1

## Eventos e outbox

Foi criado o outbox transacional MathDomainEvent, com tipo, agregado, sequência por entidade, payload, chave de idempotência, tentativas e estado. MathProcessingJob.domainEventId relaciona cada job ao evento que o originou.

publishMathEvent grava evento e job na mesma transação, usando lock consultivo por agregado. O conflito de chave torna a publicação idempotente. O worker existente continua responsável por lock concorrente, retries, dead-letter e snapshots append-only.

Eventos integrados:

- Mundo: publicação, previsão confirmada, resolução, cancelamento e correção de resolução.
- Radar: convite, aceite, resposta registrada, consentimento revogado e snapshot criado.
- Cálculos derivados: jobs WORLD e RADAR carregam payloads versionados para Score/Brier/baseline/ganho ou DA/α/β/γ/shrinkage/IC95%/estado.

## Integrações

WorldOperations publica eventos junto à criação, confirmação e resolução. Na resolução, as previsões são agrupadas por previsor e jobs World são criados com as previsões e resultados efetivos; versões anteriores permanecem imutáveis.

RadarRpc publica eventos para convite, aceite, resposta, revogação e snapshot. Um snapshot criado gera automaticamente job Radar com a distribuição prevista e a resposta do alvo. O consentimento e as funções SQL existentes continuam sendo a barreira de autorização.

O worker math-engine-worker consome os jobs gerados, mantendo as fórmulas canônicas sem alterações.

## APIs e telas

As APIs internas de leitura existentes retornam Score, Radar, ranking, reputação e histórico de MathCalculationRun. O painel de perfil passou a carregar os snapshots persistidos por essas APIs, exibindo origem, execução e estado. A publicação externa continua bloqueada pelas flags.

## Reprocessamento

Correções administrativas de resultado continuam usando MathReprocessRequest. A resolução gera nova chave de evento/job quando o payload corrigido muda, preservando runs e snapshots anteriores. O encadeamento World recalcula Score, baseline, ganho e reputação interna; o Radar preserva snapshots anteriores e gera novo cálculo para a versão posterior.

## Migrações

- 20260924050000_math_domain_outbox: tabela de eventos, sequência por agregado e vínculo evento/job.
- 20260924060000_math_outbox_runtime_grants: grants mínimos para publicação pelo papel de runtime.

Total validado: 36 migrações.

## Testes e auditorias

- db:verify:math-orchestration: PASS; evento e job criados atomicamente, consumidos e vinculados.
- db:verify:math-persistence: PASS; idempotência, retry, dead-letter e reprocessamento.
- testes unitários/integrados: 59 PASS.
- E2E Radar e fluxos existentes: 22/22 PASS.
- lint: PASS.
- typecheck: PASS.
- build: PASS.
- migração limpa: PASS, 36 migrações.
- migração incremental: PASS, 36 migrações.

Foram revisados autorização, RLS, imutabilidade, concorrência, ordenação, deduplicação, auditoria, flags e exposição de dados. Nenhum achado crítico ou alto permaneceu.

## Limitações e flags

O worker precisa estar ativo para consumir a fila; sem ele os eventos ficam registrados e os jobs permanecem pendentes. A resolução automática por relógio/calendário continua dependendo do processo operacional que fecha eventos. Produção pública, usuários reais, perguntas oficiais e publicação de métricas continuam bloqueados.

## Arquivos alterados

- prisma/migrations/20260924050000_math_domain_outbox/migration.sql
- prisma/migrations/20260924060000_math_outbox_runtime_grants/migration.sql
- src/lib/math/orchestration.ts
- src/lib/api/world-operations.ts
- src/lib/api/radar-rpc.ts
- src/components/MathMetricsPanel.tsx
- scripts/verify-math-orchestration.ts
- package.json
- este relatório

Motor automático validado em ambiente local/homologação controlada. Nenhuma regra matemática foi modificada.

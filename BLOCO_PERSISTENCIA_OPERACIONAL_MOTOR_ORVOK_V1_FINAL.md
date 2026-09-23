# Persistência Operacional do Motor Matemático ORVOK V1

## Resultado

Foi implementada a camada operacional para enfileirar, processar, persistir e consultar artefatos do Motor Matemático V1. O serviço reutiliza `src/lib/math-engine.ts` sem alterar fórmulas, thresholds, versões ou estados canônicos.

Produção, publicação externa, usuários reais, ranking público e reputação pública continuam bloqueados pelas flags existentes. O catálogo Radar permanece `PROPOSTA_PARA_APROVACAO`.

## Worker e fluxo

`scripts/math-engine-worker.ts` executa o worker com credencial de owner (`DB_OWNER_URL`), processa lotes e pode permanecer em loop com `MATH_WORKER_ONCE=0`. `MathPersistence` implementa:

- fila `PENDING → RUNNING → COMPLETED`;
- lock concorrente com `FOR UPDATE SKIP LOCKED`;
- chave de idempotência única;
- retry exponencial até cinco tentativas;
- estado `DEAD` após falha definitiva;
- snapshots append-only e hash de entrada;
- reprocessamento com nova execução, operador, motivo e timestamp.

Os domínios persistidos são World (Brier, baseline, ganho, estado e reputação interna), Consenso (pooling log-odds leave-one-out com quórum canônico) e Radar (DA, α, β, γ, shrinkage, IC95%, `n_eff` e estado).

## APIs

Foram adicionadas rotas autenticadas em `/api/v1`:

- `POST /math/jobs`: enfileira cálculo para administrador/moderador;
- `POST /math/reprocess`: solicita reprocessamento auditado;
- `GET /math/score`, `/math/radar`, `/math/ranking`, `/math/reputation`, `/math/history`: leitura versionada, somente interna.

As rotas exigem autenticação, autorização por papel e ficam indisponíveis quando o ambiente não habilita cálculo interno. Nenhuma delas publica métricas em produção.

## Banco e migração

A migração `20260924030000_math_operational_persistence` adiciona:

- `MathProcessingJob` com idempotência, tentativas, lock, erro e agendamento;
- `MathRankingSnapshot`;
- `MathReputationSnapshot`;
- `MathReprocessRequest`;
- índices operacionais e triggers de imutabilidade;
- grants somente de leitura dos artefatos e inserção controlada de jobs para o papel de aplicação, quando existente.

Total validado: 33 migrações.

## Validações executadas

- `pnpm db:validate`: PASS.
- `pnpm db:verify:math-persistence`: PASS; World, Consenso e Radar persistidos; idempotência, reprocessamento, retry e dead-letter exercitados.
- `pnpm test`: PASS — 17 arquivos, 53 testes.
- `pnpm test:e2e`: PASS — 22/22.
- `pnpm lint`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm build`: PASS — 33 rotas.
- migração limpa: PASS — 33 migrações.
- migração incremental: PASS — 33 migrações e grants legados preservados.
- `git diff --check`: PASS.

## Auditoria e limitações

Foram revisados limites de autorização, isolamento do worker, imutabilidade, concorrência, retry, reprocessamento, exposição de API e feature flags. Não foram encontrados achados críticos ou altos nesta camada.

O worker recebe payloads de cálculo já resolvidos; a integração automática com todos os eventos e avaliações de produção depende de uma etapa posterior de orquestração de domínio. O cálculo permanece interno e não substitui os snapshots brutos.

## Arquivos alterados

- `src/lib/math/persistence.ts`
- `scripts/math-engine-worker.ts`
- `scripts/verify-math-persistence.ts`
- `src/app/api/v1/[[...path]]/route.ts`
- `prisma/migrations/20260924030000_math_operational_persistence/migration.sql`
- `package.json`
- este relatório

## Estado final

O Git será registrado com um commit próprio após esta validação. Produção pública, usuários reais, operação comercial, aprovação jurídica e publicação de resultados continuam bloqueados.

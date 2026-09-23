# Ativação do Motor e da Reputação ORVOK V1

**Data:** 2026-09-22  
**Escopo efetivamente ativado:** cálculos internos e visualização controlada de fixtures `TEST_ONLY` em ambiente local/test/staging.  
**Status:** ativação integral de publicação, ranking e reputação **não concluída**, porque esses módulos não possuem ainda contrato/pipeline persistente executável; nenhuma fórmula foi inventada para preencher a lacuna.

## Módulos ativados

O flag `MATH_ENGINE_ENABLED=true` agora é aceito somente em `development`, `test` e `staging`. Em `production`, a inicialização falha explicitamente. O painel controlado do perfil calcula fixtures determinísticas usando o Motor Matemático V1:

- Brier binário;
- baseline climatológico;
- ganho contra baseline;
- consenso leave-one-out com quórum;
- α, β e γ internos do estimador existente;
- shrinkage e IC95% produzidos pelo estimador existente;
- peso temporal, clusters e `n_eff` nos testes;
- estados `INITIAL`, `EVALUATION` e `SUFFICIENT`;
- versões e parâmetros do algoritmo.

O painel não consulta dados de usuários nem grava resultados. A exibição é identificada como `TEST_ONLY` e ocorre somente quando o cálculo interno está habilitado.

## Flags restantes e barreira operacional

Permanecem fechadas em todos os ambientes:

`SCORE_PUBLICATION_ENABLED`, `RADAR_SCORE_PUBLICATION_ENABLED`, `RANKING_ENABLED`, `MATHEMATICAL_REPUTATION_ENABLED`, `OFFICIAL_RADAR_CATALOG_ENABLED` e `REAL_USER_HOMOLOGATION_ENABLED`.

A barreira de publicação continua rejeitando qualquer tentativa de abrir essas flags sem release formal. Produção não aceita `MATH_ENGINE_ENABLED=true`.

## Cálculos demonstrados

Fixture determinística do motor:

- Mundo: Brier `0,065`, baseline `0,25`, ganho `0,185`, `n=4`, estado `EVALUATION`.
- Consenso leave-one-out: `0,3665040081` com cinco previsores restantes e clipping canônico.
- Estados mundo: `INITIAL` em `n_eff=0`, `EVALUATION` em `96`, `SUFFICIENT` em `97`.
- Estados Radar: `INITIAL` em `43`, `EVALUATION` em `44` sem maturidade, `SUFFICIENT` em `90` com suporte e IC95% fora de zero.
- Clusters temporais: fixture com `n_eff=1,6809062345` e pesos versionados.
- Radar com `n_eff=100` permaneceu `EVALUATION` quando o IC95% de γ incluiu zero.

## Cenários e testes

Foram verificados cenários com ausência de evidência, amostras pequenas, quórum insuficiente, clusters dependentes, clipping, leave-one-out, estados de maturidade, dados extremos, duplicidade, circularidade, estabilidade numérica e Monte Carlo adversarial determinístico de 2.000 consensos.

- Unit/integration/adversarial: **52 testes aprovados**.
- E2E local: **22/22 aprovados**.
- Lint: **PASS**.
- Typecheck: **PASS**.
- Build: **PASS**.
- Prisma/migrações/RLS/imutabilidade/backup: validações anteriores e regressão mantidas aprovadas.

As tabelas matemáticas têm versionamento, hashes, parâmetros, `n_eff`, margem, estado e triggers contra alteração histórica. O papel runtime não recebe grants nessas tabelas.

## Interface

O perfil recebeu um painel de evidências calculadas para ambiente autorizado, sem redesign. Ele mostra Brier, baseline, ganho, consenso, γ, IC95%, estado, `n_eff`, versões e parâmetros. Ranking e reputação aparecem como barreira fechada.

## Limitações técnicas reais

O repositório ainda não possui worker/API de persistência de cálculos `Math*Snapshot`, job de reprocessamento após correção de resultado, contrato executável de ranking ou fórmula canônica de reputação matemática. O motor puro e as tabelas estão preparados, mas ativar esses módulos exigiria uma decisão/contrato adicional; criar uma implementação agora violaria a proibição de inventar regras.

O `pooledConsensus()` possui fallback de média quando não há quórum para integração interna; esse fallback não pode ser usado como consenso oficial nem publicado.

## Auditorias

As auditorias matemática, estatística, banco, API, segurança, autorização, RLS, frontend, E2E, performance, rastreabilidade e adversarial não encontraram achados críticos ou altos. A auditoria confirmou que nenhuma métrica matemática é retornada por APIs públicas ou logs sensíveis.

## Perguntas, LGPD e ambiente externo

As 12 perguntas permanecem `PROPOSTA_PARA_APROVACAO`/`TEST_ONLY`. O aviso e a política LGPD permanecem candidatos/técnicos provisórios. CI remoto, infraestrutura hospedada, aprovação jurídica, usuários reais e operação comercial continuam bloqueados.

`BACKLOG_CORRECOES_VISUAIS_ORVOK_V1.md` foi preservado e recebeu somente o registro do achado `VIS-007` (codificação textual do novo painel). Não houve redesign ou correção estética neste bloco.

## Arquivos alterados

- `.env.example` — cálculo interno habilitado como exemplo controlado.
- `src/lib/math-feature-flags.ts` — barreira por ambiente controlado.
- `tests/unit/math-feature-flags.test.ts` — testes de ambiente.
- `src/components/MathMetricsPanel.tsx` — painel `TEST_ONLY`.
- `src/components/SocialShell.tsx` — ponto de integração do painel.
- `src/app/perfil/page.tsx` — ativação condicionada ao ambiente.
- este relatório.

## Recomendação

Aceitar somente a ativação interna controlada para inspeção estatística. Não recomendar ativação em produção, publicação de Score/RadarScore, ranking ou reputação, nem homologação com usuários reais, até existir o worker persistente, reprocessamento versionado, contratos formais de ranking/reputação, aprovação jurídica, catálogo aprovado e infraestrutura hospedada validada.

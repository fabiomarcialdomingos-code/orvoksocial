# Bloco Radar Humano Social V1 — relatório final

Data: 22/09/2026. Escopo entregue: **fluxo técnico TEST_ONLY para homologação local**. Não há autorização para usuários reais, publicação de perguntas oficiais ou operação comercial. Implementação: `0c9f7f9497e1c028d9e156326e9c4c466fbceb50`. O hash do commit deste relatório consta no histórico Git imediatamente posterior a esse commit.

## 1. Resultado e limites

O fluxo com duas contas verificadas percorreu convite, aceite, apresentação do aviso, concessões distintas `SELF_ANSWER` e `BE_PREDICTED`, respostas próprias, escolha e confirmação da previsão, snapshot imutável, reciprocidade estrutural, revogação, notificações, exportação e pedido de exclusão. A API e o banco exigem sessão, ator, ordem temporal, vínculo do aviso ao aceite e consentimento ativo. A interface mostra estados operacionais e nenhum resultado de habilidade.

**Avaliação após resposta posterior do alvo permanece bloqueada.** A V2 canônica §§5–6 e o M55 exigem gabarito válido antes da previsão, seguido de resolução/avaliação. Uma resposta posterior não substitui o gabarito congelado nem dispara avaliação retroativa. Não há contrato ratificado de revelação/resolução, e scoring está fora do escopo. O teste E2E demonstra apenas a confirmação estrutural do snapshot.

## 2. Funcionalidades e arquivos

| Área | Entrega e arquivos principais |
| --- | --- |
| Catálogo | `prisma/schema.prisma`, `scripts/import-radar-catalog.ts`, `fixtures/radar-catalog-test-only.json`, `prisma/seed.ts`: versão, hash, opções, proveniência `TEST_ONLY`, controle de publicação. A fixture tem dois itens fictícios, não as 12 perguntas. |
| Banco e limites | Oito migrações `20260922160000` a `20260922230000`, `scripts/provision-runtime-roles.ts`: RLS, RPCs vinculadas à sessão, triggers, índices, notificações, histórico append-only e proteção contra dois grants ativos do mesmo aceite. Total: 24 migrações, incluindo as 16 anteriores. |
| Serviços e API | `src/lib/radar-consent.ts`, `src/lib/api/radar-rpc.ts`, `src/app/api/v1/[[...path]]/route.ts`, `src/lib/api/response.ts`: convite/aceite, aviso, concessão/revogação, respostas, oportunidades, previsões, snapshots, projeções, inbox. Contratos em `docs/CONTRATOS_RADAR_SOCIAL_TEST_ONLY_V1.md` e `docs/CONTRATOS_API_OPERACIONAIS_V1.md`. |
| Telas | `src/app/radar`, `src/app/aceitar-convite`, `src/app/consentimento`, `src/app/meus-dados`, `src/components/RadarWorkspace.tsx`, `RadarFlow.tsx`, `SnapshotView.tsx`, `DataRightsPanel.tsx`, `src/app/globals.css`: painel, confirmação, estados de carga/vazio/erro/sucesso e navegação móvel. |
| Operação | `.github/workflows/ci.yml`, `scripts/ci-export-runtime-env.mjs`, `scripts/radar-metrics.ts`, scripts de backup, reconstrução, checksum e verificações; `README.md`, `docs/OPERACAO_LOCAL_E_TESTE.md`, `docs/RADAR_V1_GATES_DE_HOMOLOGACAO.md`, `docs/RADAR_V1_OBSERVABILIDADE.md`, `docs/RASTREABILIDADE_INICIAL.md`. |
| Testes | `tests/e2e/radar-ui.spec.ts`, `tests/e2e/radar-real.spec.ts`, testes de integração e verificadores `scripts/verify-radar-{concurrency,hardening}.ts`. |

## 3. Banco, contratos e autorização

As migrações Radar criam o catálogo e controles de fixture, restringem leitura e escrita por papel, vinculam apresentação do aviso ao aceite exato, preservam versões de respostas e snapshot, registram notificações e proveniência do consentimento e serializam concessões concorrentes. `20260922230000` impede um segundo `BE_PREDICTED` ativo para o mesmo aceite, inclusive por escrita owner direta; após revogação, nova apresentação pode sustentar nova versão sem apagar histórico. Snapshot e apresentação não são sobrescritos. O papel web não tem DML direto sobre tabelas críticas.

`/api/v1` oferece catálogo, respostas próprias, oportunidades, dashboard (feitas, recebidas, pendentes, matches), convites, aceite, aviso, consentimento, previsão, snapshot, notificações e direitos do titular. Schemas, códigos de erro, paginação de listas e idempotência estão documentados nos contratos citados. O dashboard limita cada painel aos 20 registros recentes com `hasMore`, ainda sem navegação para o restante. GETs são `no-store`; respostas e gabarito do alvo não são entregues ao previsor. Notificações apenas de convite/aceite/revogação, com estados `UNREAD`, `READ`, `DISMISSED`; gatilhos/canais finais aguardam decisão de produto.

Autorização: usuário autenticado e verificado atua somente por sua sessão; previsor vê suas previsões; alvo vê somente as projeções compartilhadas e pode revogar seus grants; terceiro não vê respostas, snapshots ou inbox alheios; administrador/owner executa importação e operação fora do runtime; app role usa apenas RPC e RLS. Match significa exclusivamente dois convites aceitos com grants ativos recíprocos. Não expressa afinidade, compatibilidade ou habilidade.

## 4. Consentimento, revogação e direitos

O aviso `BE_PREDICTED` deve ter sido apresentado ao alvo, na mesma sessão e no contexto do mesmo aceite antes da concessão. `SELF_ANSWER` tem finalidade separada. O snapshot guarda o grant e a versão de consentimento. Revogação impede nova previsão e retira exposição futura das projeções e matches, preservando o histórico restrito para auditoria. A exportação é do próprio titular; o pedido de exclusão é registrado e auditado. **Não há exclusão automática nem prazo de retenção inventado**: a política LGPD segue técnica e provisória, sujeita à revisão jurídica.

O catálogo oficial não foi publicado. `import-radar-catalog.ts` recusa `APPROVED`; `TEST_ONLY` requer banco local `_dev`/`_test`, flag explícita e controle owner. Ambiente staging/production bloqueia Radar quando há material de teste, inclusive restaurado. Publicação exige ratificação das 12 perguntas, opções, famílias, versão, manifesto/hashes e revisão jurídica; o checklist está em `docs/RADAR_V1_GATES_DE_HOMOLOGACAO.md`.

## 5. Evidências de validação

| Verificação local | Resultado |
| --- | --- |
| `db:validate`, `db:migrate`, `db:smoke` | Passaram; PostgreSQL 18.6, 24 migrações. |
| `db:verify:clean-database` e `db:verify:incremental-database` | Passaram, 24/24; trajetória incremental preservou grants legados e rejeitou fixture legada mal classificada. |
| `db:verify:consent-migrations`, `db:verify:runtime-boundary`, `db:verify:read-boundary` | Passaram; separação de papéis, sessão e leitura cruzada. |
| `db:verify:radar-rpc`, `db:verify:radar-concurrency`, `db:verify:radar-hardening` | Passaram; ordem, revogação concorrente, aviso A/B, RLS, gabarito congelado e raiz duplicada. |
| `db:verify:backup-restore` | Passou em banco isolado; 24 migrações e contagens Radar preservadas. |
| `lint`, `typecheck`, `test`, `build` | Passaram; Vitest 13 arquivos/37 testes; Next.js 16.3.6 compilou. Hook do commit repetiu lint, typecheck e 37 testes com sucesso. |
| `test:e2e` | 22/22 passaram, inclusive duas contas com PostgreSQL, seis larguras do Radar, teclado/foco, revogação e direitos do titular. |
| `git diff --cached --check`, `git check-ignore` | Sem erro de whitespace; `.env`, `.env.local` e `.local/postgres-password` ignorados. |
| `format:check` | Não passou: 76 arquivos, inclusive documentos e código preexistentes, divergem do Prettier. Não consta do CI nem é um teste funcional; normalização ampla foi evitada neste bloco. |

O CI foi estendido para instalar, migrar, provisionar papéis, semear/importar somente fixture, validar banco, lint, tipos, testes, build e E2E. A exportação de URLs de runtime para `GITHUB_ENV` não imprime segredos. `git remote -v` não retornou remoto; **nenhum sucesso de CI remoto ou infraestrutura hospedada é declarado**.

## 6. Auditorias independentes e achados

Especialistas de backend/banco, frontend e auditoria adversarial revisaram código e fluxos em paralelo; a validação final integrada foi executada pelo agente principal. A coluna de teste aponta evidência observada, não apenas intenção.

| Inspeção | Severidade, evidência e causa | Correção / estado e teste |
| --- | --- | --- |
| Arquitetura | Médio: projeções do dashboard expõem só 20 itens, contrato ainda não navega ao restante. | Limite e `hasMore` explícitos no contrato; paginação completa pendente, sem abertura real. Testes de contrato. |
| Banco/migrações | Alto: múltiplos grants ativos do mesmo aceite permitiam exposição após revogar apenas um. | Trigger serializado + validação de serviço em `20260922230000`; teste direto/serviço e RPC de duplicidade passaram. |
| Autenticação/autorização | Alto: papel runtime podia inicialmente ler versões candidatas do catálogo. | Política RLS e controle de fixture; `verify-radar-hardening`, `verify-read-boundary` passaram. |
| Consentimento/LGPD | Alto: aviso do convite A poderia ser usado no B; fixture histórica com proveniência errada podia alimentar concessões. | Binding imutável de aceite e guarda de proveniência nas migrações 180000, 210000, 220000; teste A/B e migração incremental passaram. Revisão jurídica continua bloqueante. |
| Segurança ofensiva/bypass | Alto: corrida entre resposta nova do alvo e previsão poderia congelar versão incoerente. | Lock do alvo e guarda causal em 190000; `verify-radar-concurrency` passou. DML direto do app role negado. |
| API/contratos | Médio: verificador RPC supunha hash de aviso fixture mesmo quando selector escolhia aviso seed. | Teste passou a usar hash/versão efetivamente apresentados; `verify-radar-rpc` passou. Contrato `TEST_ONLY` publicado. |
| Frontend/UX/layout | Alto: primeiro aviso assíncrono poderia substituir aviso do aceite atual; convite expirado seguia clicável. | Estado vinculado ao aceite e indisponibilidade explícita; E2E de aviso atrasado/convite expirado passou. |
| Acessibilidade/mobile | Médio: risco de transbordamento e confirmação ilegível em 320 px. | Componentes e CSS responsivos; E2E em seis larguras, foco, teclado e skip link passaram. Leitor de tela humano ainda requer homologação. |
| Notificações | Médio: estado poderia ser mutado por terceiro/repetido sem semântica clara. | Transições owner-only e auditadas; E2E `UNREAD→READ→DISMISSED` e testes de autorização passaram. Gatilhos finais pendentes. |
| Auditoria/observabilidade | Médio: testes de bloqueio poderiam falhar sem evento rastreável. | RPC/serviço registram tentativas negadas; `radar:metrics` emite somente agregados. Monitor hospedado pendente. |
| Testes/rastreabilidade | Alto: fixtures dos verificadores antigos contrariavam dedupe de convite e seleção do aviso. | Fixtures ajustadas sem relaxar proteção; todos os verificadores e 37 testes passaram. RHV1-01–06 atualizados. |
| Backup/produção | Alto: restauração poderia reintroduzir fixture histórica como consentimento operacional. | Guarda de proveniência e bloqueio de ambiente; migração incremental e backup/restore passaram. Sem remoto, alerta ou operação hospedada testada. |

Não restaram achados críticos/altos conhecidos no **escopo TEST_ONLY validado localmente**. Esta afirmação não equivale a homologação de segurança ou LGPD para pessoas reais.

## 7. Riscos e decisões para o próximo bloco

Bloqueios para usuários reais: 12 perguntas oficiais, instrumento/manifesto aprovado, avisos jurídicos finais, revisão LGPD de retenção e exclusão, contrato de resolução/revelação, infraestrutura hospedada e CI remoto observável. Ainda dependem de decisão expiração padrão de convite, semântica de match além da reciprocidade estrutural e gatilhos/canais de notificação. O formato do dashboard para mais de 20 itens e a normalização Prettier são dívidas técnicas não críticas para homologação local. Não foram implementados scoring, RadarScore, γ, shrinkage, consenso, ranking, reputação, calibração, ligas, feed completo ou publicação pública.

Para reproduzir localmente: instalar Node 24.18.0 e pnpm 10.34.5; iniciar PostgreSQL 18 via `scripts/local-db.ps1`; executar `corepack pnpm install --frozen-lockfile`, `corepack pnpm db:migrate`, `corepack pnpm db:provision:local` (ou `db:provision:reapply`), `ORVOK_ALLOW_TEST_SEED=1 corepack pnpm db:seed` e importar `fixtures/radar-catalog-test-only.json` com a mesma flag. Depois executar `corepack pnpm build`, `corepack pnpm dev` e os comandos da seção 5. O PowerShell requer `$env:ORVOK_ALLOW_TEST_SEED='1'` antes dos dois comandos de fixture. URLs e segredos ficam em `.env`/`.env.local`, ignorados. O runbook detalhado está em `docs/OPERACAO_LOCAL_E_TESTE.md`.

**Recomendação:** aceitar este bloco como fluxo estrutural de homologação TEST_ONLY. Autorizar em bloco separado a ratificação das perguntas e contratos de resolução/revelação, revisão jurídica e implantação de staging com CI remoto; manter operação real e matemática bloqueadas até os respectivos gates.

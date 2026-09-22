# Fase 0 — relatório de fundação

**Data:** 22/09/2026
**Escopo:** fundação técnica e ambiente reprodutível, conforme autorização após Gate 0.
**Status:** checks locais aprovados; commit inicial registrado ao encerrar a fase. CI configurada, ainda sem execução remota porque não há remoto Git neste repositório.

## Resultado e alterações

Git `main` foi inicializado sem recuperar os 190 arquivos removidos. A aplicação foi criada com Next.js/App Router e página estática de fumaça. Há configurações TypeScript rigorosas para o código próprio, ESLint, Prettier, Tailwind, Vitest, Playwright, Prisma 7, PostgreSQL, hooks Git e workflow CI. O schema Prisma ainda não contém modelos do produto; a migração de fundação executa apenas `SELECT 1` para verificar o mecanismo de migrations. O seed não insere dados. Nenhum módulo de Score, Radar, consentimento ou política de dados pessoais foi implementado.

## Árvore versionada prevista

```text
.
├── .github/workflows/ci.yml
├── .githooks/{commit-msg,pre-commit}
├── .editorconfig  .gitattributes  .gitignore  .nvmrc
├── .env{,.test,.staging,.production}.example
├── .prettierignore  .prettierrc.json
├── ORVOK_DIAGNOSTICO_PRE_IMPLEMENTACAO_V1.md
├── README.md  package.json  pnpm-lock.yaml  pnpm-workspace.yaml
├── eslint.config.mjs  next.config.ts  next-env.d.ts
├── playwright.config.ts  postcss.config.mjs  prisma.config.ts
├── tsconfig.json  vitest.config.ts
├── docs/{ADR-001-fundacao.md,FASE_0_RELATORIO.md,RASTREABILIDADE_INICIAL.md}
├── prisma/
│   ├── schema.prisma  seed.ts
│   └── migrations/{migration_lock.toml,20260922000000_foundation/migration.sql}
├── scripts/{db-smoke.ts,local-db.ps1}
├── src/app/{globals.css,layout.tsx,page.tsx}
├── src/lib/env.ts
└── tests/{unit/env.test.ts,e2e/foundation.spec.ts}
```

`node_modules/`, `.next/`, `.local/`, `.env` e relatórios de teste são ignorados.

## Versões efetivamente instaladas

| Componente                       |                   Versão |
| -------------------------------- | -----------------------: |
| Node.js / npm                    |         24.18.0 / 12.0.2 |
| pnpm (Corepack)                  |                  10.34.5 |
| Next.js / eslint-config-next     |          16.3.6 / 16.3.6 |
| React / React DOM                |          19.3.0 / 19.3.0 |
| TypeScript                       |                    5.9.3 |
| Prisma CLI / Client / adapter-pg | 7.10.0 / 7.10.0 / 7.10.0 |
| PostgreSQL local                 |                     18.6 |
| Tailwind CSS / PostCSS plugin    |            4.3.3 / 4.3.3 |
| Vitest / Playwright              |          4.1.11 / 1.63.0 |
| ESLint / Prettier                |           9.39.5 / 3.9.8 |
| pg / dotenv / zod                |  8.23.0 / 17.4.2 / 4.6.5 |

Versões diretas estão exatas em `package.json`; versões transitivas e hashes de integridade estão no lockfile. PostgreSQL 18 é compatível com [Prisma ORM 7](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), e Node 24 atende [Prisma 7](https://www.prisma.io/docs/orm/v7/reference/system-requirements) e [Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16).

## Reprodução local

Executar os comandos documentados no [`README.md`](../README.md): `COREPACK_HOME` local, `corepack pnpm install --frozen-lockfile`, `scripts/local-db.ps1`, `pnpm db:validate`, `pnpm db:migrate`, `pnpm db:smoke`, `pnpm dev`. Para verificar: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. O PostgreSQL de desenvolvimento usa SCRAM e loopback; sua senha aleatória fica apenas em arquivos ignorados. Nenhuma credencial externa foi usada.

## Evidências executadas

| Verificação                  | Resultado                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Instalação congelada/offline | `pnpm install --frozen-lockfile --offline`: lockfile atualizado, nenhuma resolução ou download   |
| Prisma schema                | `pnpm db:validate`: válido                                                                       |
| Migração                     | `pnpm db:migrate`: 1/1 aplicada em `orvok_dev`, sem tabelas de produto                           |
| Banco                        | `pnpm db:smoke`: PostgreSQL 18.6, 1 migração aplicada                                            |
| Lint                         | `pnpm lint`: 0 erros e 0 avisos                                                                  |
| Tipagem                      | `pnpm typecheck`: aprovado                                                                       |
| Formatter                    | `pnpm format:check`: aprovado                                                                    |
| Unitários                    | `pnpm test`: 1 arquivo, 2 testes aprovados                                                       |
| Build                        | `pnpm build`: aprovado; rota `/` prerenderizada                                                  |
| E2E                          | `pnpm test:e2e`: 1 teste Chromium aprovado, página compilada                                     |
| Segredos                     | `git check-ignore` confirmou `.env` e `.local/` excluídos; revisão do índice Git antes do commit |

O Vitest, `tsx`, `pg_ctl`, Prisma e o build exigiram execução fora das restrições de processo/cache do sandbox local. Isso não alterou os comandos versionados nem exigiu segredos em Git. A execução do workflow CI remoto só será evidenciada quando houver remoto e execução de Actions; a configuração local equivalente foi executada.

## Inspeções independentes por eixo

| Eixo                      | Evidência/achado                                                                                                                | Severidade residual                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Arquitetura               | A página de fumaça não importa domínio; módulo matemático não foi iniciado. A separação de módulos está registrada em ADR e 09. | Nenhum alto para Fase 0                             |
| Banco/migrações           | Uma migration técnica versionada, `schema.prisma` válido, seed sem dados e smoke SQL. Modelo de produto aguarda Fase 1.         | Nenhum alto para Fase 0                             |
| Regras/fórmulas           | Nenhuma fórmula implementada; D1/L1/L2 seguem bloqueadas.                                                                       | Não aplicável à implementação de Fase 0             |
| Segurança/autorização     | `.env`/`.local` ignorados; banco isolado com SCRAM/loopback. Auth/RBAC ainda não existem por escopo.                            | Médio: implantação futura requer TLS/secret manager |
| Privacidade/LGPD          | Nenhum dado pessoal semeado; nenhuma política de exclusão inventada. L3 bloqueia fase afetada.                                  | Não aplicável à implementação de Fase 0             |
| APIs/contratos            | Nenhuma API de produto criada; contrato de env validado por schema.                                                             | Não aplicável à implementação de Fase 0             |
| Frontend/acessibilidade   | Página de fumaça tem idioma, título e heading; E2E a encontrou por papel. Identidade final aguarda fase visual.                 | Baixo: página provisória                            |
| Responsividade/desempenho | CSS da página usa largura fluida/clamp; build gera HTML estático. QA visual final aguarda frontend real.                        | Baixo: placeholder                                  |
| Testes/cobertura          | Vitest 2/2, E2E 1/1, smoke DB e checks locais verdes. Não há fluxos de produto para cobrir.                                     | Nenhum alto para Fase 0                             |
| Observabilidade/auditoria | Migração auditada em `_prisma_migrations`; logs de smoke não expõem credenciais. Observabilidade do produto será posterior.     | Médio para produção futura                          |
| Aderência documental      | Stack de 09, fases de 10 e Gate 0 preservados; 43 requisitos continuam rastreados, nenhum produto implementado.                 | Nenhum alto para Fase 0                             |
| Produção                  | CI configurada e build aprovado; sem execução remota, backup/restore ou homologação, que pertencem às fases 14–18.              | Alto para produção, fora do gate da Fase 0          |

**Riscos remanescentes:** ESLint 9.39.5 está marcado como deprecated pelo registro; uma atualização dentro da linha permitida deve ser avaliada em fase técnica futura com seus testes. CI ainda não foi executada em serviço remoto. Fase 0 está apta pelo gate local, sem afirmar prontidão de produção.

## Próximas decisões

D1 (Score sem quórum), D2 (gabarito e snapshot), L1 (estimador γ/IC), L2 (peso de clusters), L3 (retenção/exclusão), L4 (progressão para 44/90 itens), L5 (matriz RBAC/compartilhamento) e L6 (contratos finos de fluxos). A autorização para Fase 1 é separada e ainda não foi concedida.

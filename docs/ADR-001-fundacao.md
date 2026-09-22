# ADR-001 — Fundação técnica da Fase 0

**Data:** 22/09/2026
**Status:** decisão técnica de execução; não altera produto nem motor matemático.

## Contexto e decisões

- Seguir 09 — Arquitetura Técnica V1: Next.js 16/App Router, React 19, TypeScript rigoroso, Tailwind 4, Prisma 7 e PostgreSQL 18. O sistema local dispõe de Node 24.18.0 e PostgreSQL 18.6. [Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16) requer Node 20.9+; [Prisma 7](https://www.prisma.io/docs/orm/v7/reference/system-requirements) suporta Node 24.
- Usar pnpm 10.34.5 via Corepack e `pnpm-lock.yaml` congelado. `package.json` e `.nvmrc` declaram as versões; o relatório final registra as versões resolvidas.
- Usar ESLint, Prettier, Vitest e Playwright. Hooks Git locais validam mensagem e checks básicos; CI repete lint/typecheck/test/build. Os hooks são configurados em cada clone por `git config core.hooksPath .githooks`.
- Usar Prisma 7 apenas para uma migração de fundação (`SELECT 1`) e histórico `_prisma_migrations`. Nenhum modelo de produto ou seed de usuário é criado antes da Fase 1. O smoke SQL usa `pg` diretamente; o adapter Prisma fica instalado para os módulos futuros.
- Para o teste local da Fase 0, criar cluster PostgreSQL isolado em `.local/`, com SCRAM, senha aleatória ignorada pelo Git e escuta só em `127.0.0.1`. Produção exige credenciais e TLS geridos pelo ambiente de implantação.
- A página `/` é exclusivamente uma resposta de fumaça da infraestrutura. Ela não representa a interface final nem antecipa fluxos de produto.

## Consequências e limites

O lockfile e a migration tornam a fundação reproduzível. Não há entidades, Score, consentimento implementado, Radar ou políticas LGPD no código. D1, D2 e L1–L6 do diagnóstico continuam pendentes para suas fases. Mudanças na stack congelada exigem registro de impacto e aprovação conforme 09/10.

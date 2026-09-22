# ORVOK Social — fundação técnica

Este repositório contém a **Fase 0** aprovada: infraestrutura, configuração e testes de fumaça. A interface exibida em `/` é provisória e não representa o produto final. As regras oficiais estão no pacote documental e no [diagnóstico Gate 0](ORVOK_DIAGNOSTICO_PRE_IMPLEMENTACAO_V1.md).

## Versões e pré-requisitos

Node 24.18.0 (`.nvmrc`), pnpm 10.34.5 (Corepack), PostgreSQL 18.6 local ou compatível com a linha 18. As dependências JavaScript ficam fixadas em `pnpm-lock.yaml` após instalação. Nunca versionar `.env` ou `.local/`.

## Execução local no Windows

```powershell
$env:COREPACK_HOME=(Join-Path (Get-Location) '.local\corepack')
corepack pnpm install --frozen-lockfile
./scripts/local-db.ps1
corepack pnpm db:validate
corepack pnpm db:migrate
corepack pnpm db:smoke
corepack pnpm dev
```

`local-db.ps1` requer os executáveis do PostgreSQL 18 em `C:\Program Files\PostgreSQL\18\bin` (ou `-PostgresBin` explícito). Cria o banco `orvok_dev` em cluster privado da pasta `.local`, na porta 55432, gera senha aleatória e escreve somente em `.local/postgres-password` e `.env`, ambos ignorados. Não usar esse cluster para produção. O script pode ser executado novamente para iniciar o cluster; não sobrescreve a credencial. Para interromper: `& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D .local/postgres-data stop`.

Em outro ambiente, forneça `DATABASE_URL` por secret manager ou crie `.env` a partir de `.env.example` com credenciais próprias; mantenha `APP_ENV` coerente. Exemplos para test/staging/production descrevem apenas formatos, sem segredos. Ambiente hospedado requer TLS e gestão de credenciais própria.

## Verificação

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm db:smoke
corepack pnpm test:e2e
```

Playwright usa Chromium; instale o navegador uma vez com `corepack pnpm exec playwright install chromium`. O smoke E2E inicia `next start` após o build. Os testes unitários não precisam de banco. O CI executa instalação congelada, lint, typecheck, unitários e build; a verificação PostgreSQL é local nesta fase e será levada à CI de integração quando houver modelos de domínio.

## Git e decisões

Após instalar dependências, ative os hooks locais com `git config core.hooksPath .githooks`. Mensagens seguem `type(scope): descrição`; o pre-commit executa lint, typecheck e testes. Consulte [ADR-001](docs/ADR-001-fundacao.md) e a [matriz inicial](docs/RASTREABILIDADE_INICIAL.md). Fase 1 depende de nova autorização.

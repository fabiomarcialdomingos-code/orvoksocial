# ORVOK Social

> **ORVOK 2:** redesenho, correções de banco e testes ponta a ponta estão descritos em [`docs/ORVOK-2.md`](docs/ORVOK-2.md). Capturas de tela em `docs/screenshots/`.

Aplicação Next.js com PostgreSQL e Prisma. O Radar usa dados de teste em desenvolvimento; conteúdo e avisos oficiais ainda precisam de aprovação antes do uso com pessoas reais.

## Requisitos

- Node.js 24.18.0 (`.nvmrc`) e pnpm 10.34.5 via Corepack.
- PostgreSQL 18 para a instalação local, ou serviço PostgreSQL compatível no ambiente de hospedagem.

## Executar localmente no Windows

```powershell
$env:COREPACK_HOME=(Join-Path (Get-Location) '.local\corepack')
corepack pnpm install --frozen-lockfile
./scripts/local-db.ps1
corepack pnpm db:validate
corepack pnpm db:migrate
corepack pnpm db:provision:local
corepack pnpm dev
```

`local-db.ps1` usa o PostgreSQL instalado em `C:\Program Files\PostgreSQL\18\bin` ou o caminho informado por `-PostgresBin`. O banco, sua senha e o cache do Corepack ficam em `.local/`. As variáveis locais ficam em `.env` e `.env.local`; preserve esses arquivos e nunca os publique. As opções de ambiente estão nos arquivos `.env*.example`.

`DATABASE_URL` pertence às migrações e ao provisionamento. A aplicação usa `APP_DATABASE_URL` e `AUTH_DATABASE_URL` com papéis distintos. Após novas migrações locais, execute `corepack pnpm db:provision:reapply`.

## Produção e processos auxiliares

```powershell
corepack pnpm build
corepack pnpm start
corepack pnpm auth:mail-worker
corepack pnpm math:worker
```

O worker de e-mail depende das variáveis SMTP, `AUTH_SECRET` e `AUTH_MAIL_KEY`. O login Google exige `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI`. Configure segredos fora do Git. O worker matemático e o worker de e-mail devem usar o mesmo banco da aplicação.

O código de origem está em `src/`, o esquema e as migrações em `prisma/`, e os scripts de operação em `scripts/`. O cliente Prisma gerado fica em `generated/`. O build atual fica em `.next/` e as dependências instaladas em `node_modules/`.

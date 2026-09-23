# ORVOK Social — fundação técnica

**Radar Humano Social V1 em testes controlados:** o fluxo técnico inclui catálogo versionado, fixtures `TEST_ONLY`, painéis e jornada social sob consentimento. As 12 perguntas oficiais e o aviso jurídico aprovado continuam ausentes; nenhum dado de pessoas reais deve ser coletado nessa jornada. Consulte [a operação local](docs/OPERACAO_LOCAL_E_TESTE.md), [os contratos Radar](docs/CONTRATOS_RADAR_SOCIAL_TEST_ONLY_V1.md), [os gates de homologação](docs/RADAR_V1_GATES_DE_HOMOLOGACAO.md) e [a rastreabilidade](docs/RASTREABILIDADE_INICIAL.md). Scoring, RadarScore, γ, consenso e ranking permanecem fora do escopo.

Este repositório contém a fundação técnica e operacional para testes controlados: identidade, contratos `/api/v1`, fluxo estrutural Radar, consentimento versionado e interfaces-base. O Radar real continua bloqueado sem aviso oficial aprovado, catálogo oficial de perguntas e revisão jurídica aplicável. As regras oficiais estão na [V2 canônica](ORVOK_FECHAMENTO_LACUNAS_MATEMATICA_LGPD_CONTRATOS_V2_CANONICA.md), na [hierarquia documental](ORVOK_HIERARQUIA_DOCUMENTAL_REV02_CANONICA.md) e no [diagnóstico Gate 0](ORVOK_DIAGNOSTICO_PRE_IMPLEMENTACAO_V1.md). A V2 externa anterior e o ZIP divergente são obsoletos.

## Versões e pré-requisitos

Node 24.18.0 (`.nvmrc`), pnpm 10.34.5 (Corepack), PostgreSQL 18.6 local ou compatível com a linha 18. As dependências JavaScript ficam fixadas em `pnpm-lock.yaml` após instalação. Nunca versionar `.env` ou `.local/`.

## Execução local no Windows

```powershell
$env:COREPACK_HOME=(Join-Path (Get-Location) '.local\corepack')
corepack pnpm install --frozen-lockfile
./scripts/local-db.ps1
corepack pnpm db:validate
corepack pnpm db:migrate
corepack pnpm db:provision:local
corepack pnpm db:smoke
corepack pnpm dev
```

`local-db.ps1` requer os executáveis do PostgreSQL 18 em `C:\Program Files\PostgreSQL\18\bin` (ou `-PostgresBin` explícito). Cria o banco `orvok_dev` em cluster privado da pasta `.local`, na porta 55432, gera senha aleatória e escreve somente em `.local/postgres-password` e `.env`, ambos ignorados. Não usar esse cluster para produção. O script pode ser executado novamente para iniciar o cluster; não sobrescreve a credencial. Para interromper: `& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D .local/postgres-data stop`.

`DATABASE_URL` pertence apenas a migrações, verificação e provisionamento. A aplicação exige `APP_DATABASE_URL` e `AUTH_DATABASE_URL`, de papéis PostgreSQL distintos e sem privilégio de DDL. `db:provision:local` gera credenciais aleatórias em `.env.local` ignorado pelo Git e recusa sobrescrever esse arquivo; após novas migrações, `db:provision:reapply` preserva as credenciais. Em outro ambiente, forneça as URLs por secret manager e provisione os papéis depois das migrações usando `APP_DB_PASSWORD` e `AUTH_DB_PASSWORD`; mantenha `APP_ENV` coerente. Exemplos para test/staging/production descrevem apenas formatos, sem segredos. Ambiente hospedado requer TLS e gestão de credenciais própria.

## Verificação

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm db:smoke
corepack pnpm db:verify:consent-migrations
corepack pnpm test:e2e
```

Playwright usa Chromium; instale o navegador uma vez com `corepack pnpm exec playwright install chromium`. O smoke E2E inicia `next start` após o build. Os testes de integração usam PostgreSQL, migrações aplicadas e papéis de runtime provisionados. O CI executa instalação congelada, migração limpa/incremental, lint, typecheck, testes com PostgreSQL, build e E2E.

## Autenticação e entrega de e-mail de teste

Configure `APP_ORIGIN`, `AUTH_SECRET` (pelo menos 32 caracteres aleatórios) e `AUTH_MAIL_KEY` (32 bytes aleatórios em hexadecimal) fora do Git. Os arquivos `.env.*.example` contêm somente marcadores. `AUTH_SECRET` protege os hashes de sessão, token e limite de tentativas; `AUTH_MAIL_KEY` cifra o payload da fila SMTP. Perder a chave da fila impossibilita entregar mensagens antigas; a rotação dessas chaves exige procedimento operacional próprio. Em produção, `APP_ORIGIN` deve usar HTTPS e cookies de sessão são `HttpOnly`, `Secure` e `SameSite=Lax`.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` e, em SMTP remoto, `SMTP_USER`/`SMTP_PASS`. O worker `corepack pnpm auth:mail-worker` lê mensagens da fila criptografada, usa TLS para servidores remotos, tenta novamente com atraso exponencial até cinco tentativas e não escreve tokens em logs. Em desenvolvimento, use apenas servidor SMTP fake em loopback na porta 1025; nunca aponte a instância de teste para caixas reais. Um processo web e um worker devem compartilhar o mesmo banco. Sem worker e servidor SMTP configurado, cadastro, verificação e recuperação ficam enfileirados e a entrada de usuários de teste não está operacionalmente pronta.

As rotas `POST /api/v1/auth/register`, `login`, `logout`, `rotate`, `request-reset`, `reset-password` e `verify-email` aceitam apenas JSON com Origin igual a `APP_ORIGIN`. `register` e `request-reset` respondem de modo genérico. O catálogo Radar oficial permanece vazio. Para operação contínua é necessário monitorar mensagens não entregues (`AuthMailOutbox.attempts=5`), sessões inválidas, erros 5xx, fila de pedidos de dados e configurar backup seguro do banco e das chaves. Consulte os [contratos de autenticação](docs/CONTRATOS_AUTH_V1.md), os [contratos operacionais](docs/CONTRATOS_API_OPERACIONAIS_V1.md) e o [runbook](docs/OPERACAO_LOCAL_E_TESTE.md).

## Git e decisões

Após instalar dependências, ative os hooks locais com `git config core.hooksPath .githooks`. Mensagens seguem `type(scope): descrição`; o pre-commit executa lint, typecheck e testes. Consulte [ADR-001](docs/ADR-001-fundacao.md), [ADR-002](docs/ADR-002-fundacao-operacional.md), a [matriz inicial](docs/RASTREABILIDADE_INICIAL.md) e o [contrato estrutural](docs/CONTRATOS_DADOS_FASE_1_ESTRUTURAL.md). A autorização atual não cobre scoring, consenso, RadarScore, γ, shrinkage, ranking, perguntas oficiais ou telas completas de produto; novas etapas dependem de autorização expressa.
## Login Google (configuração por ambiente)

O login Google usa OAuth/OIDC oficial e permanece desativado enquanto `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` não estiverem configurados. Crie um cliente Web no Google Cloud, habilite Google Identity, cadastre as origens autorizadas e use exatamente estes callbacks:

- local: `http://localhost:3000/api/v1/auth/google/callback`;
- homologação: callback HTTPS do ambiente homologado;
- produção: callback HTTPS do domínio oficial.

Os valores reais devem existir somente no secret manager ou no arquivo `.env` local ignorado. Para rotação, crie um novo segredo no provedor, atualize o ambiente, valide o callback e revogue o segredo anterior. O callback valida state, nonce, issuer, audience, redirect URI, expiração e e-mail verificado; tokens Google não são persistidos.

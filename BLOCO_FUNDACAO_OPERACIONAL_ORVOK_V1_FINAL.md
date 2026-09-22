# Bloco de fundação operacional ORVOK V1 — relatório final

**Data:** 22/09/2026. **Escopo:** fundação para testes controlados. **Commit da implementação validada:** `846daaa66dea121e10de69eacf26557adf7430b6`. Este relatório é registrado em commit posterior para poder citar o hash da implementação sem autorreferência. A Fase 1 do produto continua parcial; scoring, consenso e RadarScore seguem sem autorização.

## 1. Resumo executivo

A base operacional foi implementada e validada localmente com PostgreSQL 18.6: autenticação, sessões, autorização por objeto e no banco, consentimento versionado, ordem temporal, APIs `/api/v1`, direitos técnicos de dados, telas-base e testes automatizados. O papel web não tem DML direto nas tabelas Radar nem leitura irrestrita de dados pessoais. **Não houve abertura de contas externas ou implantação comercial.** O Radar com pessoas reais permanece fechado porque faltam aviso oficial aprovado, catálogo oficial de perguntas e revisão jurídica da política LGPD provisória.

## 2. Funcionalidades implementadas

| Domínio | Comportamento entregue |
| --- | --- |
| Identidade | Cadastro com confirmação por e-mail, login/logout, recuperação, senha derivada com sal, tokens opacos armazenados por hash, sessão em cookie seguro, rotação e revogação de família. Outbox cifrada e worker SMTP com retry. |
| Segurança HTTP | Validação Zod, corpo limitado, Origin e Fetch Metadata para mutações, cookies `HttpOnly`/`SameSite`, `Secure`/`__Host-` em produção, resposta de erro com `requestId`, cabeçalhos de segurança e logs 5xx estruturados sem payload privado. |
| Radar estrutural | Convite, aceite pelo alvo, apresentação do aviso aprovado na sessão, grant versionado, resposta própria, previsão com snapshot imutável, revogação e bloqueio posterior. Catálogo real e avisos permanecem vazios. |
| Privacidade | Exportação paginada em stream ao titular, pedido auditado de exportação grande e de exclusão, sem eliminação automática ou prazo de retenção inventado. |
| APIs | Contratos versionados de identidade, usuário próprio, convite, consentimento, resposta, previsão, snapshot, auditoria administrativa, exportação, exclusão e inbox de notificações. Mutações operacionais têm idempotência; listas têm cursor. |
| Interface | Tokens e fontes do Visual REV02, navegação, estados vazios/erro/carregamento, telas de cadastro, login, recuperação, verificação, convite, aceite e consentimento; o botão de consentir fica indisponível sem aviso aprovado. |
| Operação | CI PostgreSQL, papéis de runtime separados, verificadores de migração limpa/incremental, fronteira SQL, ensaio local de backup/restauração e runbook. |

## 3. Arquivos alterados e estrutura

O commit de implementação contém **120 arquivos alterados/criados**. Arquivos principais: `prisma/schema.prisma`; 15 novas migrações em `prisma/migrations/20260922010000_*` até `20260922150000_*` (16 no total, contando a fundação); `src/lib/auth/`, `src/lib/api/`, `src/lib/radar-consent.ts`, `src/lib/access-control.ts`, `src/lib/runtime-boundary.ts`, `src/instrumentation.ts`; `src/app/api/v1/`, `src/app/{cadastro,entrar,recuperar,nova-senha,verificar-email,convites,aceitar-convite,consentimento}/`, `src/components/`; `tests/unit/`, `tests/integration/`, `tests/e2e/`; `scripts/verify-*.ts`, `scripts/provision-runtime-roles.ts`, `scripts/auth-mail-worker.ts`; CI e arquivos `.env.*.example`; `README.md`, contratos, ADR, runbook e rastreabilidade. Os artefatos documentais REV02 previamente aprovados foram preservados e versionados neste commit. Nenhum dos 190 arquivos removidos foi restaurado, e M55/Motor Matemático V1 não foram alterados.

```text
orvok social/
├─ .github/workflows/ci.yml
├─ docs/ (ADR, contratos, fronteira de leitura, operação, rastreabilidade)
├─ prisma/ (schema, seed vazio, migrations 00000–150000)
├─ scripts/ (DB local, papéis, SMTP, migração, segurança, backup)
├─ src/app/ (base visual, telas autorizadas, api/v1)
├─ src/components/ e src/lib/ (UI, identidade, acesso, Radar estrutural)
├─ tests/unit/, tests/integration/, tests/e2e/
└─ README.md, package.json, pnpm-lock.yaml, configuração por ambiente
```

## 4. Migrações e integridade

As migrações 10000/20000 estruturam perguntas, opções, grants, respostas, convites, aceites, snapshots e guards temporais; 30000–80000 adicionam identidade, pedidos, avisos e apresentações; 90000–120000 fecham revogação de resposta própria, DML direto, grants legados e corrida de sessão; 130000–150000 implementam RLS de leitura, vínculo da sessão com `SET LOCAL` e limitador de abuso via RPC. O owner aplica migrações fora do runtime. `orvok_app_runtime` não é owner e recebe apenas permissões explícitas; `orvok_auth_runtime` não pode executar RPC Radar nem promover usuários a ADMIN.

Foram verificadas **16/16 migrações** no banco local, `migrate deploy` em banco novo com schema `public` e aplicação incremental sobre dois grants legados preservados. O verificador histórico em schema isolado cobre a cadeia até 120000; as funções `SECURITY DEFINER` de 130000–150000 usam nomes `public` deliberadamente, por isso a prova completa é feita em bancos temporários independentes. O ensaio `pg_dump`/`pg_restore` restaurou 16 migrações e contagens iguais de usuários/grants num banco isolado.

## 5. Contratos de API

Os esquemas de entrada são validados no servidor; saídas e códigos estão em [`docs/CONTRATOS_AUTH_V1.md`](docs/CONTRATOS_AUTH_V1.md) e [`docs/CONTRATOS_API_OPERACIONAIS_V1.md`](docs/CONTRATOS_API_OPERACIONAIS_V1.md). Erros não refletem SQL ou payload privado. As rotas são:

| Área | Rotas `/api/v1` | Regra principal |
| --- | --- | --- |
| Auth | `POST /auth/register`, `/verify-email`, `/login`, `/logout`, `/rotate`, `/request-reset`, `/reset-password` | JSON estrito; Origin; quotas; respostas genéricas nos pedidos que poderiam enumerar contas. |
| Usuário e Radar | `GET /users/me`, `/consent-notice`, `/radar/invitations`, `/radar/consents`, `/radar/snapshots/{id}`; `POST /radar/invitations`, `/radar/invitations/{id}/accept`, `/radar/consents`, `/radar/consents/{id}/revoke`, `/radar/self-answer-consents`, `/radar/self-answer-consents/{id}/revoke`, `/radar/answers`, `/radar/predictions` | Sessão verificada, autorização por objeto/RLS, aviso apresentado e grant ativo; mutações com chave idempotente. |
| Direitos, operação e inbox | `GET /me/export`, `/me/data-requests`, `/notifications`, `/admin/audit`; `POST /me/export-requests`, `/me/erasure-requests` | Titular ou ADMIN conforme recurso; cursor nas listas; exportação limitada a 100 MiB/120 s, pedido manual acima disso. |

## 6. Matriz de autorização

| Recurso | Titular | Previsor | Alvo | Moderador | Admin | Sistema |
| --- | --- | --- | --- | --- | --- | --- |
| Perfil, identidade, respostas próprias, pedidos de dados | Próprios | — | Próprios | — | — | Processo técnico restrito |
| Consentimento e revogação | Próprios | — | Titular do grant | — | — | RPC autenticada |
| Snapshot privado | — | Próprio, grant ativo | — | — | — | RPC/consulta restrita |
| Snapshot compartilhado | — | Próprio, grant ativo | Recebido, grant ativo | — | — | RPC/consulta restrita |
| Auditoria | Próprias | Próprias | Próprias | — | Metadados gerais | Escrita controlada |
| Notificações | Próprias | — | Próprias | — | — | Infraestrutura |
| Dados públicos/anonimizados | Sem publicação neste bloco | — | — | — | — | Sem endpoint público |

`SYSTEM` é identidade interna, nunca papel de login. A matriz executável está em `src/lib/access-control.ts`; RLS e RPCs no banco impedem contornar os filtros da rota. `ADMIN` e `MODERATOR` não recebem gabaritos privados por papel.

## 7. Fluxo de consentimento

`convite → aceite do alvo → apresentação de aviso aprovado na mesma sessão → confirmação explícita → grant com finalidade/escopo/hash/versão → respostas próprias com consentimento separado → previsão → snapshot imutável`. A revogação cria evento append-only e impede nova previsão ou acesso compartilhado. A previsão exige resposta do alvo e do previsor anteriores ao snapshot; consentimento legado sem apresentação não pode autorizar nova resposta. Chamadas com aviso ausente recebem 503, hash/versão divergente são recusados, e o cliente nunca fornece o gabarito do alvo. O campo de estado de evidência é somente estrutural; nenhum cálculo foi executado.

## 8. Testes executados

| Verificação | Resultado local |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm db:validate`, `pnpm build` | Aprovados; build Next gerou 18 rotas/páginas. |
| `pnpm test` | **13 arquivos, 36 testes aprovados**; inclui identidade, SMTP fake, API, autorização, consentimento, revogação, concorrência e banco. O hook do commit repetiu os 36 testes e lint/typecheck com sucesso. |
| `pnpm test:e2e` | **11/11 aprovados**; login/logout real com usuário sintético, UI, aviso indisponível, teclado/foco e seis larguras oficiais. |
| `db:migrate`, `db:smoke`, `db:verify:clean-database`, `db:verify:incremental-database`, `db:verify:consent-migrations` | 16 migrações aplicadas; banco novo e legado aprovados. |
| `db:verify:runtime-boundary`, `db:verify:read-boundary`, `db:verify:radar-rpc` | DML direto negado, leitura cruzada negada, sessão revogada negada, corrida serializada e fluxo Radar estrutural aprovado. |
| `db:verify:backup-restore` | `pg_dump`/`pg_restore` local aprovado em banco temporário. |

O CI foi configurado para repetir instalação congelada, PostgreSQL, migrações, verificadores, testes, build e Playwright. **Não há execução remota do CI neste relatório**; a evidência acima é local.

## 9. Auditorias especializadas e 10. falhas corrigidas

Os especialistas de banco, identidade, API, frontend, segurança e acessibilidade trabalharam/revisaram em frentes próprias; arquitetura, privacidade, testes, operação, rastreabilidade e revisão final foram inspeções temáticas adversariais consolidadas aqui. Cada linha registra um achado real, inclusive quando a inspeção foi simulada.

| Inspetor | Severidade e evidência | Causa | Correção | Prova |
| --- | --- | --- | --- | --- |
| Arquitetura | Alta: owner URL poderia chegar ao Next em staging/produção (`src/lib/auth/session.ts`, `.env.*.example`). | Mesma credencial para migração e runtime. | Papéis separados e guarda de inicialização; owner só em CLI. | `runtime-boundary.test.ts`, provisionamento e build. |
| Banco/Prisma | Crítica: DML SQL direto podia fabricar grants/snapshots (`prisma/migrations/20260922020000_*`). | Triggers validavam regras, mas runtime era owner. | Migração 100000, RPCs autenticadas e REVOKE; 110000/120000 corrigem legado e corrida. | `verify-runtime-boundary`, `verify-radar-rpc-flow`, migração incremental. |
| Autenticação/autorização | Alta: links SMTP apontavam a rotas inexistentes e token na query (`src/lib/auth/mail.ts`). | Caminhos não alinhados à UI. | Rotas corretas, token no fragmento e remoção após captura. | SMTP fake, E2E de links e login/logout. |
| Privacidade/LGPD | Alta: grant `SELF_ANSWER` legado sem aviso podia autorizar resposta (`ConsentGrant`). | Migração histórica preservava registros sem apresentação. | Trigger 110000 bloqueia novos usos sem apagar histórico. | Verificador incremental e fluxo RPC. |
| Segurança ofensiva | Alta: papel app podia ler linhas pessoais de terceiros (`scripts/provision-runtime-roles.ts`). | SELECT amplo sem limite por sessão. | RLS 130000–150000, `SET LOCAL`, sessão validada e lock; rate limit via RPC. | `verify-read-boundary`: sem hash, hash falso, outro ator, reuso e revogação. |
| API/contratos | Alta: replay idempotente podia devolver 201 após revogação (`src/app/api/v1/[[...path]]/route.ts`). | Cache não rechecava elegibilidade. | Revalidação antes de replay; corpo limitado a 64 KiB; erro com versão. | `replay-revocation.test.ts`, `operational-api.test.ts`. |
| Testes | Alta: verificação “limpa” anterior usava schema no banco já migrado (`scripts/verify-consent-migrations.ts`). | Funções qualificadas em `public` podiam mascarar falha. | Banco temporário realmente vazio e outro incremental com dados legados. | 16/16 em ambos; restauração adicional. |
| Frontend/responsividade | Média: overflow móvel e troca rápida de aceite podia exibir aviso antigo (`src/components/RadarFlow.tsx`, CSS). | Largura e resposta assíncrona sem vínculo visual. | CSS responsivo, cancelamento/ref do aceite e validação do vínculo na API. | E2E em 1440/1280/1024/768/390/375; teste de aviso/aceite. |
| Acessibilidade | Média: foco de baixo contraste, menu móvel incompleto e botões de revogação homônimos (`globals.css`, `SiteHeader.tsx`, `RadarFlow.tsx`). | Tokens e nomes acessíveis incompletos. | Foco escuro, link Comunidade, rótulo por grant/versão e `aria-pressed`. | E2E de foco, teclado do menu/aviso e duas opções de revogação. |
| Observabilidade/operação | Média: 5xx de auth sem evento estruturado e backup sem ensaio (`auth/http.ts`, runbook). | Instrumentação inicial limitada. | Log JSON com `requestId` sem payload; ensaio `pg_dump`/`pg_restore`. | Testes HTTP e `db:verify:backup-restore`. |
| Rastreabilidade documental | Média: README/contrato estrutural ainda descreviam somente F0/F1 parcial. | Artefatos anteriores mantidos sem adendo. | Atualização explícita, FOP-01–11 e links para ADR/contratos; histórico preservado. | Revisão da matriz e `git diff` sem M55/Motor. |
| Auditor final adversarial | Alta: sessão podia ser revogada entre verificação e escrita/leitura (`orvok_radar_actor`, exportação). | Ausência de lock na validação. | `FOR SHARE` e serialização de grant/RPC/exportação. | Testes concorrentes de revogação e snapshot, boundary de leitura. |

Não restam achados técnicos críticos/altos conhecidos dentro do escopo local validado. O teste de adulteração AES-GCM foi tornado determinístico após falha intermitente; a asserção passou na suíte e no hook do commit. Falhas `EPERM` do sandbox ao iniciar auxiliares foram repetidas fora dele, com os verificadores aprovados.

## 11. Riscos e bloqueios restantes

1. **Liberação externa bloqueada:** aviso oficial de consentimento e 12 perguntas Radar não foram fornecidos; não criar fixtures em produção. A política LGPD é técnica provisória e requer revisão jurídica, inclusive bases, aviso de cadastro, execução de exclusão e retenção de backups antes de dados pessoais reais/operacão comercial.
2. Staging/produção ainda exigem configuração e ensaio de HTTPS, SMTP real, segredos gerenciados, alertas, limites na borda e backup externo agendado. A restauração foi ensaiada localmente, não em infraestrutura hospedada.
3. Exportação maior que 100 MiB ou interrompida fica em fluxo manual; pedido de exclusão registra e audita, mas não elimina automaticamente. Reexecução de idempotência em estado `PENDING` requer reconciliação auditada.
4. Se o processo web inteiro for comprometido, ele contém credenciais runtime de app/auth e segredos de sessão. RLS protege contra abuso da credencial app isolada, não contra comprometimento integral do host. Defesa de borda, isolamento de segredos e monitoramento seguem necessários.
5. O CI remoto, testes de carga e auditoria jurídica não foram executados. Não há métrica pública nem ranking neste bloco.

## 12. Itens deliberadamente não implementados

Score, consenso, RadarScore, γ, shrinkage, rankings, ligas, reputação final, feed, moderação de produto completa, gatilhos de notificações não ratificados, publicação pública, 12 perguntas oficiais, cálculo de estados de evidência e operação comercial. `INITIAL/EVALUATION/SUFFICIENT` são tipos estruturais, sem cálculo/publicação.

## 13. Hash do commit

Implementação e artefatos anteriores aprovados: `846daaa66dea121e10de69eacf26557adf7430b6`. O commit posterior deste relatório é informado na entrega ao usuário.

## 14. Execução local

Use Node **24.18.0**, pnpm **10.34.5**, Next **16.3.6**, React **19.3.0**, Prisma **7.10.0**, PostgreSQL **18.6**. No Windows, na raiz do projeto:

```powershell
$env:COREPACK_HOME=(Join-Path (Get-Location) '.local\corepack')
corepack pnpm install --frozen-lockfile
./scripts/local-db.ps1
corepack pnpm db:migrate
corepack pnpm db:provision:local
corepack pnpm db:verify:clean-database
corepack pnpm db:verify:incremental-database
corepack pnpm db:verify:runtime-boundary
corepack pnpm db:verify:read-boundary
corepack pnpm db:verify:radar-rpc
corepack pnpm db:verify:backup-restore
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
corepack pnpm dev
```

`db:provision:local` só deve ser executado na primeira vez; após nova migração use `db:provision:reapply`. Worker de e-mail: `corepack pnpm auth:mail-worker` com SMTP fake local ou servidor configurado fora do Git. Detalhes e condições no [`README.md`](README.md) e [`docs/OPERACAO_LOCAL_E_TESTE.md`](docs/OPERACAO_LOCAL_E_TESTE.md). `.env`, `.env.local` e `.local/` são ignorados. Não usar a senha PostgreSQL fornecida na conversa em arquivos versionados.

## 15. Recomendação sobre o próximo bloco

**Não autorizar ainda scoring, consenso, RadarScore ou uso comercial.** A fundação técnica permite prosseguir com piloto **sintético e interno** em staging após executar o CI remoto e verificar HTTPS, SMTP, alertas e backup nesse ambiente. Para usuários reais e fluxo Radar, exigir antes o aviso e catálogo oficiais, revisão jurídica da política LGPD e decisão formal sobre direitos/exclusão. Qualquer bloco seguinte deve receber autorização expressa e escopo próprio.

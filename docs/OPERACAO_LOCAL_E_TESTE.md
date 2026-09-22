# Operação local e testes controlados — fundação V1

Esta é uma fundação para contas de teste, sem autorização para operação comercial ou Radar real. O catálogo oficial de perguntas e o aviso de consentimento aprovado não existem neste repositório; a API recusa concessões sem aviso publicado. Não semear conteúdo fictício em ambientes com pessoas reais.

## Separação de credenciais

Use Node 24.18.0, pnpm 10.34.5 e PostgreSQL 18.6. `DATABASE_URL` é a credencial de migração/owner e só deve existir nos processos administrativos. `APP_DATABASE_URL` é a credencial de API com leitura limitada e execução de funções Radar controladas; `AUTH_DATABASE_URL` é a credencial da identidade. Nenhuma das duas deve ser owner ou superuser. `APP_ORIGIN`, `AUTH_SECRET` e `AUTH_MAIL_KEY` são obrigatórios; SMTP precisa de host, porta e remetente, além de autenticação quando aplicável. Não use credenciais reais em arquivos versionados.

No Windows, a partir da raiz do projeto:

```powershell
$env:COREPACK_HOME=(Join-Path (Get-Location) '.local\corepack')
corepack pnpm install --frozen-lockfile
./scripts/local-db.ps1
corepack pnpm db:migrate
corepack pnpm db:provision:local
corepack pnpm db:verify:consent-migrations
corepack pnpm db:verify:clean-database
corepack pnpm db:verify:incremental-database
corepack pnpm db:verify:backup-restore
corepack pnpm db:verify:runtime-boundary
corepack pnpm db:verify:read-boundary
corepack pnpm db:verify:radar-rpc
corepack pnpm db:smoke
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

O provisionador `--local` grava apenas `.env.local`, ignorado pelo Git, com senhas aleatórias e recusa sobrescrever arquivo existente. Em ambiente hospedado, o DBA aplica migrações com URL owner e executa o provisionador sem `--local`, com `DB_OWNER_URL`, `APP_DB_PASSWORD` e `AUTH_DB_PASSWORD` obtidos do gestor de segredos. As duas URLs de runtime são construídas e injetadas pelo gestor de segredos; nunca as imprima em log. O owner não deve ficar disponível ao processo web ou ao worker.

Em staging e produção, uma guarda de inicialização aborta o processo se `DATABASE_URL` ou `DB_OWNER_URL` estiver presente, ou se faltar uma das URLs de runtime. O arquivo `.env` gerado pelo cluster local contém URL owner e é adequado somente para desenvolvimento/testes isolados. Para ensaiar um processo hospedado, passe a URL owner apenas ao comando de migração e remova-a do ambiente do processo web/worker antes de iniciá-los.

## Serviço web e fila de e-mail

Inicie `corepack pnpm dev` em desenvolvimento, ou `corepack pnpm start` após build. Em processo separado, execute `corepack pnpm auth:mail-worker`. Use SMTP fake em loopback para testes; sem SMTP real e worker a verificação de e-mail e a recuperação permanecem enfileiradas. Monitore `AuthMailOutbox` com `attempts >= 5`, tamanho/idade da fila e erro do worker. O teste de cadastro deve verificar a mensagem, confirmar o e-mail, fazer login e encerrar/rotacionar a sessão. O processo web não deve receber `DATABASE_URL` em ambiente hospedado.

## Verificações antes de abrir contas de teste

Confira HTTPS e `APP_ORIGIN`, cookies `HttpOnly`/`Secure`/`SameSite=Lax`, segredos fortes, conexão sob os papéis limitados, ausência de DML direto nas tabelas Radar, migrações aplicadas, SMTP e worker, limites de tentativa, logs sem dados privados, backup e restauração testados. A interface de consentimento mostra indisponibilidade quando não há aviso aprovado; isso é o comportamento correto. As doze perguntas oficiais não podem ser criadas por inferência.

## Backup, restauração e incidente

O backup deve incluir o PostgreSQL e as chaves necessárias para decifrar a fila de e-mail; mantenha ambos fora do Git, com acesso restrito e criptografia. Use `pg_dump`/`pg_restore` da mesma linha principal do servidor num banco isolado de ensaio; após restaurar, execute `db:validate`, `db:smoke`, verifique a contagem de migrações e execute os testes de integridade. Não restaure dados pessoais em desenvolvimento compartilhado. Teste periodicamente a recuperação de um snapshot, grants/revogações e a impossibilidade de sobrescrevê-los. A estratégia de retenção de backup e a rotina jurídica de eliminação dependem da revisão da política LGPD provisória; nenhum prazo é definido aqui.

Em incidente de sessão, revogue a família no banco pelo serviço autenticado e invalide cookies; em suspeita de vazamento de segredo, gire credenciais e sessões de modo coordenado. A rotação de `AUTH_MAIL_KEY` exige esvaziar/reconciliar a outbox porque mensagens antigas cifradas dependem da chave anterior. Interrompa novas contas e fluxos Radar se a barreira de papéis, o SMTP ou o backup falharem.

## Limites conhecidos

Exportação é stream de até 100 MiB/120 s; acima disso o pedido fica para tratamento manual. Solicitação de exclusão não apaga automaticamente registros imutáveis; revisão jurídica determinará a execução, exceções e retenção. Rate limits persistidos no banco são controles de abuso iniciais, não defesa de borda distribuída. Produção exige WAF/limite na borda, monitoramento, alertas, ensaio de restauração e análise jurídica. O log estruturado não deve conter senha, token, gabarito ou vetor de previsão.

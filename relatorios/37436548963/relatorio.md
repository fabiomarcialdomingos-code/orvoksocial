# Relatório da simulação de 30 usuários

Execução `37436548963` contra `https://orvok.com.br` em 2026-10-06T08:30:40.493Z (duração 339 s).

## Resumo

- **188 verificações passaram** e **2 falharam**, de 190.
- **842 requisições** feitas por 30 usuários fictícios (18 com conta, 12 convidados sem cadastro) mais um visitante anônimo.
- **Achados:** 0 crítico, 2 alto, 2 médio, 0 baixo, 2 informativo.
- **Erros do servidor (5xx ou sem resposta):** 0.

## Achados

### [Alto] O cadastro cria a conta já verificada, sem confirmar o e-mail
*Fase: 3. Contas, senhas e sessões*

As 19 contas de teste nasceram com verifiedAt preenchido no ato do cadastro. Qualquer pessoa pode cadastrar o e-mail de outra pessoa. Combinado com o login do Google (que se junta à conta existente com o mesmo e-mail sem apagar a senha), isso permite sequestro prévio de conta; veja a fase "Autenticação em profundidade".

### [Alto] A recuperação de senha não entrega o e-mail
*Fase: 3. Contas, senhas e sessões*

O pedido entra na fila (AuthMailOutbox), mas nada entrega a fila: não há worker agendado nem tarefa na Vercel (sem vercel.json/cron). Quem esquecer a senha não consegue recuperar a conta.

### [Médio] O endereço da foto de perfil aceita qualquer esquema (javascript:, data:)
*Fase: 7. Perfil, grupos, notificações e direitos sobre os dados*

POST /social/profile com avatarUrl='javascript:alert(1)' foi aceito. Hoje as telas só mostram a inicial do nome, então não executa, mas qualquer tela futura que use esse endereço num link ou imagem vira um ponto de ataque. Convém aceitar só https.

### [Médio] Qualquer pessoa pode travar o login de outra conta
*Fase: 9. Concorrência (corridas)*

Poucas tentativas com senha errada bloqueiam por 15 minutos até a senha certa. Quem sabe o e-mail de alguém consegue impedir que ela entre. O limite por conta é útil contra adivinhação, mas combinado com um limite global (1000 tentativas/15 min para o site todo) também permite bloquear o login do site inteiro com poucas requisições.

### [Informativo] Sequestro prévio de conta não foi exercitado nesta execução
*Fase: 3b. Autenticação em profundidade (só local)*

Exige o segredo do servidor (AUTH_SECRET), que só existe no ambiente local. Foi verificado na simulação local.

### [Informativo] A Estante não foi exercitada de ponta a ponta nesta execução
*Fase: 6. Estante*

Está desligada (e sem a chave da Anthropic). O fluxo completo foi testado na simulação local com o modo simulado; aqui só se confirmou que ela não vaza nada enquanto desligada.

## Verificações por fase

| Fase | Passaram | Falharam |
|---|---|---|
| 1. Preparação | 1 | 0 |
| 2. Segurança: visitante sem login | 52 | 0 |
| 3. Contas, senhas e sessões | 38 | 1 |
| 4. Retrato: convites, respostas e moderação | 24 | 0 |
| 5. Mundo: rodadas, revelação e conversas | 22 | 0 |
| 6. Estante | 11 | 0 |
| 7. Perfil, grupos, notificações e direitos sobre os dados | 25 | 1 |
| 8. Autorização cruzada (IDOR) | 7 | 0 |
| 9. Concorrência (corridas) | 7 | 0 |
| 10. Carga: 30 usuários ao mesmo tempo | 1 | 0 |

### Verificações que falharam

- **3. Contas, senhas e sessões** — o e-mail de recuperação de senha é entregue em até 20 s _({"n":1,"entregues":0})_
- **7. Perfil, grupos, notificações e direitos sobre os dados** — avatarUrl com javascript: é recusado _(status 200)_

## Desempenho

Todas as requisições: p50 **405 ms**, p95 **1956 ms**, p99 **2770 ms**, máximo 3937 ms.

Durante a carga dos 30 usuários simultâneos (420 requisições): p50 **144 ms**, p95 **1376 ms**, p99 **1415 ms**; erros 5xx: **0**.

| Rota | Chamadas | p50 | p95 | Erros 5xx |
|---|---|---|---|---|
| GET /api/v1/me/export | 2 | 3937 ms | 3937 ms | 0 |
| POST /api/v1/auth/register | 47 | 1960 ms | 2993 ms | 0 |
| POST /api/v1/desafio/:codigo/tentativa | 69 | 1403 ms | 2770 ms | 0 |
| POST /api/v1/me/export-requests | 3 | 1628 ms | 2731 ms | 0 |
| POST /api/v1/social/groups | 2 | 2454 ms | 2454 ms | 0 |
| POST /api/v1/social/profile | 8 | 1632 ms | 2333 ms | 0 |
| POST /api/v1/me/erasure-requests | 2 | 2225 ms | 2225 ms | 0 |
| POST /api/v1/mundo/r/:codigo | 7 | 838 ms | 1901 ms | 0 |
| POST /api/v1/mundo/rodadas/:codigo/conversa | 68 | 934 ms | 1792 ms | 0 |
| POST /api/v1/auth/login | 79 | 931 ms | 1754 ms | 0 |
| POST /api/v1/auth/request-reset | 2 | 1588 ms | 1588 ms | 0 |
| POST /api/v1/auth/reset-password | 1 | 1527 ms | 1527 ms | 0 |
| GET /api/v1/users/me | 34 | 706 ms | 1495 ms | 0 |
| GET /api/v1/notifications | 29 | 699 ms | 1434 ms | 0 |

Códigos de resposta: 200: 623 · 201: 19 · 202: 31 · 204: 3 · 400: 28 · 401: 41 · 403: 16 · 404: 24 · 405: 2 · 409: 5 · 413: 1 · 415: 1 · 429: 48.

## Monitoramento durante a execução

162 amostras (a cada 2 s).

- Conexões abertas ao banco: máximo **17** (consultas ativas ao mesmo tempo: máximo 1).
- Transações no período: 2378 confirmadas, **13 desfeitas** (rollback); deadlocks: **0**; arquivos temporários: 0.

## Análise dos logs do servidor

Os logs do servidor não estavam disponíveis para esta execução.

## Limpeza

Linhas apagadas: Mundo: rodadas, conversas e denúncias: 6; Retrato: respostas dos convites: 64; Retrato: denúncias de convites: 1; Retrato: bloqueios: 1; Retrato: traços ocultos: 1; Retrato: linha do tempo: 25; Retrato: convites: 10; Medição: eventos dos convites, rodadas e lembranças da simulação: 91; Mundo: opções do evento de teste: 2; Mundo: evento de teste: 1; Conta: AuditLog: 82; Conta: AuthMailOutbox: 1; Conta: AuthSession: 25; Conta: AuthToken: 1; Conta: DataRequest: 2; Conta: Notification: 10; Conta: ApiIdempotency: 2; Conta: UserProfile: 6; Conta: SocialGroupMember: 1; Conta: SocialBlock: 1; Conta: SocialReport: 1; Conta: UserAgeConsent: 1; Conta: identidades de login: 21; Conta: SocialGroup: 1; Conta: usuários: 21.

**Tabelas com contagem diferente do início:**

- AuditLog: antes 7, depois 8
- AuthRateLimit: antes 6, depois 122

Resíduos esperados:
- 118 contadores de limite de tentativas (AuthRateLimit) ainda ativos: expiram sozinhos em até 1 hora e não guardam dado de pessoa

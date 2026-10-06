# Relatório da simulação de 30 usuários

Execução `37468753105` contra `https://orvok.com.br` em 2026-10-06T13:10:57.585Z (duração 384 s).

## Resumo

- **189 verificações passaram** e **1 falharam**, de 190.
- **842 requisições** feitas por 30 usuários fictícios (18 com conta, 12 convidados sem cadastro) mais um visitante anônimo.
- **Achados:** 0 crítico, 2 alto, 0 médio, 0 baixo, 3 informativo.
- **Erros do servidor (5xx ou sem resposta):** 0.

## Achados

### [Alto] O cadastro cria a conta já verificada, sem confirmar o e-mail
*Fase: 3. Contas, senhas e sessões*

As 19 contas de teste nasceram com verifiedAt preenchido no ato do cadastro. Qualquer pessoa pode cadastrar o e-mail de outra pessoa. O sequestro prévio via Google já foi corrigido (a senha é apagada quando o Google se junta à conta), mas só a confirmação por e-mail fecha o problema: ligue AUTH_REQUIRE_EMAIL_VERIFICATION=1 depois de configurar o envio de e-mail (SMTP_*).

### [Alto] A recuperação de senha não entrega o e-mail
*Fase: 3. Contas, senhas e sessões*

O pedido entra na fila (AuthMailOutbox) e agora a entrega é tentada logo depois do pedido, mas o envio de e-mail não está configurado (faltam SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM na Vercel). Até configurar, quem esquecer a senha não consegue recuperar a conta.

### [Informativo] Sequestro prévio de conta não foi exercitado nesta execução
*Fase: 3b. Autenticação em profundidade (só local)*

Exige o segredo do servidor (AUTH_SECRET), que só existe no ambiente local. Foi verificado na simulação local.

### [Informativo] A Estante não foi exercitada de ponta a ponta nesta execução
*Fase: 6. Estante*

Está desligada (e sem a chave da Anthropic). O fluxo completo foi testado na simulação local com o modo simulado; aqui só se confirmou que ela não vaza nada enquanto desligada.

### [Informativo] O bloqueio de login por origem não é verificável de um único IP
*Fase: 9. Concorrência (corridas)*

Na produção todas as tentativas saem do mesmo IP, então o dono parece bloqueado junto com o atacante. A separação por origem foi verificada no teste automático (test:auth) e na simulação local com duas origens.

## Verificações por fase

| Fase | Passaram | Falharam |
|---|---|---|
| 1. Preparação | 1 | 0 |
| 2. Segurança: visitante sem login | 52 | 0 |
| 3. Contas, senhas e sessões | 38 | 1 |
| 4. Retrato: convites, respostas e moderação | 24 | 0 |
| 5. Mundo: rodadas, revelação e conversas | 22 | 0 |
| 6. Estante | 11 | 0 |
| 7. Perfil, grupos, notificações e direitos sobre os dados | 26 | 0 |
| 8. Autorização cruzada (IDOR) | 7 | 0 |
| 9. Concorrência (corridas) | 7 | 0 |
| 10. Carga: 30 usuários ao mesmo tempo | 1 | 0 |

### Verificações que falharam

- **3. Contas, senhas e sessões** — o e-mail de recuperação de senha é entregue em até 20 s _({"n":1,"entregues":0})_

## Desempenho

Todas as requisições: p50 **457 ms**, p95 **2446 ms**, p99 **3100 ms**, máximo 3959 ms.

Durante a carga dos 30 usuários simultâneos (420 requisições): p50 **141 ms**, p95 **1371 ms**, p99 **1413 ms**; erros 5xx: **0**.

| Rota | Chamadas | p50 | p95 | Erros 5xx |
|---|---|---|---|---|
| GET /api/v1/me/export | 2 | 3959 ms | 3959 ms | 0 |
| POST /api/v1/auth/register | 47 | 2000 ms | 3237 ms | 0 |
| POST /api/v1/auth/login | 79 | 1182 ms | 3100 ms | 0 |
| POST /api/v1/desafio/:codigo/tentativa | 69 | 1418 ms | 2820 ms | 0 |
| POST /api/v1/social/groups | 2 | 2497 ms | 2497 ms | 0 |
| POST /api/v1/social/profile | 8 | 1630 ms | 2339 ms | 0 |
| POST /api/v1/me/export-requests | 3 | 1626 ms | 2252 ms | 0 |
| POST /api/v1/me/erasure-requests | 2 | 2202 ms | 2202 ms | 0 |
| POST /api/v1/auth/reset-password | 1 | 2191 ms | 2191 ms | 0 |
| GET /api/v1/me/data-requests | 1 | 2134 ms | 2134 ms | 0 |
| GET /api/v1/notifications | 29 | 707 ms | 2122 ms | 0 |
| GET /api/v1/estante/estado | 1 | 2026 ms | 2026 ms | 0 |
| POST /api/v1/mundo/r/:codigo | 7 | 841 ms | 1875 ms | 0 |
| POST /api/v1/mundo/rodadas/:codigo/conversa | 68 | 939 ms | 1811 ms | 0 |

Códigos de resposta: 200: 623 · 201: 19 · 202: 31 · 204: 3 · 400: 29 · 401: 41 · 403: 16 · 404: 24 · 405: 2 · 409: 4 · 413: 1 · 415: 1 · 429: 48.

## Monitoramento durante a execução

183 amostras (a cada 2 s).

- Conexões abertas ao banco: máximo **20** (consultas ativas ao mesmo tempo: máximo 2).
- Transações no período: 2540 confirmadas, **52 desfeitas** (rollback); deadlocks: **0**; arquivos temporários: 0.

## Análise dos logs do servidor

Os logs do servidor não estavam disponíveis para esta execução.

## Limpeza

Linhas apagadas: Mundo: rodadas, conversas e denúncias: 6; Retrato: respostas dos convites: 64; Retrato: denúncias de convites: 1; Retrato: bloqueios: 1; Retrato: traços ocultos: 1; Retrato: linha do tempo: 36; Retrato: convites: 10; Medição: eventos dos convites, rodadas e lembranças da simulação: 91; Auditoria: tentativas de login recusadas sem autor, feitas durante a simulação: 1; Mundo: opções do evento de teste: 2; Mundo: evento de teste: 1; Conta: AuditLog: 83; Conta: AuthMailOutbox: 1; Conta: AuthSession: 25; Conta: AuthToken: 1; Conta: DataRequest: 2; Conta: Notification: 11; Conta: ApiIdempotency: 2; Conta: UserProfile: 6; Conta: SocialGroupMember: 1; Conta: SocialBlock: 1; Conta: SocialReport: 1; Conta: UserAgeConsent: 1; Conta: identidades de login: 21; Conta: SocialGroup: 1; Conta: usuários: 21.

**Tabelas com contagem diferente do início:**

- AuthRateLimit: antes 123, depois 255

Resíduos esperados:
- 191 contadores de limite de tentativas (AuthRateLimit) ainda ativos: expiram sozinhos em até 1 hora e não guardam dado de pessoa

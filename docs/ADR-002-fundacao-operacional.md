# ADR-002 — fundação operacional V1

**Data:** 22/09/2026. **Estado:** decisão técnica deste bloco, subordinada a 00/01/02/03, M52–M55 e V2 canônica. Não modifica as fórmulas, os limiares nem a política jurídica provisória.

## Identidade e sessão

Cadastro produz papel `USER` e exige verificação de e-mail antes de sessão útil. Senhas são armazenadas como derivação resistente; tokens de sessão, verificação e recuperação só persistem como hash. Sessões ficam em cookie `HttpOnly`, `SameSite=Lax`, `Secure` e prefixo `__Host-` em produção. Mutações exigem origem coincidente e JSON. Rotação invalida o token anterior e replay revoga a família. Recuperação invalida sessões ativas. Mensagens de registro/recuperação saem por outbox cifrada e SMTP configurável; nenhum segredo é versionado.

## Acesso

A [matriz executável](../src/lib/access-control.ts) é de menor privilégio. `SYSTEM` é identidade interna, nunca emitida pelo login. Administrador e moderador não obtêm acesso implícito a gabaritos ou snapshots privados. Conteúdo social público e agregados anonimizados não são publicados neste bloco. Todo endpoint lê o principal da sessão no servidor e aplica restrição por objeto; regras de domínio continuam no serviço e no banco.

| Recurso | Usuário titular | Previsor | Alvo | Moderador | Administrador | Sistema |
| --- | --- | --- | --- | --- | --- | --- |
| Perfil privado | ler/editar próprio | — | — | — | — | técnico |
| Gabarito Radar | ler/criar próprio | — | — | — | — | técnico |
| Consentimento/pedido de dados | ler/criar próprio | — | — | — | — | técnico |
| Previsão/snapshot compartilhado, grant ativo | — | ler própria | ler conforme escopo | — | — | técnico |
| Notificação | ler/atualizar própria | — | — | — | — | técnico |
| Auditoria administrativa | — | — | — | — | ler | escrever |
| Moderação | — | — | — | operar | operar | técnico |
| Conteúdo público social | indisponível | indisponível | indisponível | indisponível | indisponível | técnico |
| Agregado anonimizado | ler só com anonimização verificada | idem | idem | idem | idem | técnico |

## Consentimento e direitos

O registro `ConsentNotice` permanece vazio até aprovação de conteúdo. Aviso aprovado possui finalidade, versão, texto, hash SHA-256 e aprovador administrador; sua versão é imutável. GET autenticado cria `ConsentNoticePresentation` vinculada à sessão; aceite explícito e apresentação posterior ao aceite de convite são exigidos antes do grant Radar. Grant e snapshot preservam IDs/versões. Revogação bloqueia novas previsões e exposição compartilhada. A exportação técnica e o pedido de exclusão não definem retenção, eliminação automática, exceções legais ou prazo; esses pontos dependem de revisão jurídica antes da operação comercial.

## API, operação e limites

`/api/v1` usa JSON validado, respostas de erro padronizadas, idempotência em mutações e paginação nas listas. Registro `PENDING` após queda permanece bloqueado até reconciliação; não reexecutar silenciosamente uma mutação cujo commit é incerto. Parâmetros iniciais de rate limit são controles técnicos configuráveis, sem autoridade de regra de produto. Auditoria de DML SQL abortado não persiste no próprio banco; a escrita de produção deve usar o serviço e um papel de banco sem privilégios de owner/DDL. Logs não devem conter tokens, senhas, gabaritos ou vetores privados. O worker SMTP deve operar em processo separado com monitoramento de fila/falhas.

As credenciais de runtime são separadas: `orvok_app_runtime` executa funções Radar autenticadas no banco, sem DML direto nas tabelas históricas; `orvok_auth_runtime` mantém contas/sessões, sem execução dessas funções ou atualização do papel de usuário. O owner aplica migrações somente por CLI/DBA. A inicialização web/worker em staging ou produção falha se encontrar `DATABASE_URL` ou `DB_OWNER_URL`, ou se faltar uma das URLs restritas. Isso não substitui isolamento de rede, segredo gerenciado nem revisão de acesso de leitura.

## Condições de uso

Contas de teste só devem ser abertas com HTTPS, PostgreSQL isolado, segredos fortes, SMTP operacional, monitoramento e backup/restauração ensaiados. Jornada Radar com pessoas reais segue bloqueada enquanto faltar aviso oficial aprovado, catálogo Radar aprovado e revisão jurídica aplicável. Fixtures marcadas `FIXTURE_ONLY` não são conteúdo de produção.

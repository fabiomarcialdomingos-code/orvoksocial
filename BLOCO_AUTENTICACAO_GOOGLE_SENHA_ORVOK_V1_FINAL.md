# Login Google e política de senha ORVOK V1

## Fluxo implementado

O fluxo de senha existente foi preservado e passou a usar a política V1 em cadastro, login, recuperação, redefinição e alteração autenticada. A alteração de senha revoga as sessões ativas, registra auditoria e nunca registra a senha.

O fluxo Google usa OAuth/OIDC oficial:

1. botão de login/cadastro redireciona para o Google;
2. state e nonce assinados ficam em cookie HttpOnly, SameSite=Lax, com expiração de dez minutos;
3. callback exige code, state e cookie válido;
4. o código é trocado no endpoint oficial do Google;
5. o id_token é validado via tokeninfo oficial, incluindo issuer, audience, nonce, expiração e email_verified;
6. o identificador Google é vinculado ou cria uma conta;
7. é criada uma sessão ORVOK e o usuário retorna ao caminho interno solicitado.

Cancelamento, replay, callback inválido, e-mail não verificado, conta suspensa e falha de troca retornam erro seguro sem expor tokens.

## Política de senha

Mensagem canônica:

> A senha deve conter no mínimo 8 caracteres, incluindo uma letra minúscula, uma letra maiúscula e um caractere especial.

O requisito é validado com Zod no backend e API, minLength/pattern no frontend, e nos fluxos de redefinição e alteração. Não há requisito adicional de número.

O hash continua sendo scrypt-v1 com salt aleatório individual e comparação resistente a tempo. Nenhuma senha é persistida em texto puro.

## Vinculação de contas

Foi criada AuthProviderIdentity, com unicidade por (provider, subject) e (provider, email). O serviço:

- não cria duplicata quando o e-mail já existe;
- só vincula e-mail Google verificado;
- nunca usa nome para vincular;
- rejeita mudança de e-mail para o mesmo subject;
- registra AUTH_GOOGLE_REGISTERED, AUTH_GOOGLE_LINKED, AUTH_GOOGLE_LOGIN e AUTH_GOOGLE_UNLINKED;
- fornece GET /api/v1/auth/providers para informar métodos vinculados;
- fornece POST /api/v1/auth/google/unlink, recusando a operação quando deixaria a conta sem método;
- fornece POST /api/v1/auth/change-password para adicionar senha a uma conta Google, quando o fluxo de recuperação/conta permitir.

Tokens OAuth não são gravados no banco nem enviados ao frontend.

## Rotas e interface

- GET /api/v1/auth/google/start
- GET /api/v1/auth/google/callback
- POST /api/v1/auth/google/unlink
- GET /api/v1/auth/providers
- POST /api/v1/auth/change-password

As telas de login e cadastro exibem “Continuar com Google” e “Cadastrar com Google”. A política aparece junto ao campo de senha. Cancelamento ou falha retorna mensagem objetiva na tela de login. O layout existente foi preservado.

## Banco e configuração

A migração 20260924040000_google_auth_identity torna AuthIdentity.passwordHash opcional para contas OAuth e cria AuthProviderIdentity. Total validado: 34 migrações.

Foram adicionados ao .env.example, sem valores reais:

- APP_URL;
- GOOGLE_CLIENT_ID;
- GOOGLE_CLIENT_SECRET;
- GOOGLE_REDIRECT_URI.

O README documenta criação do cliente Web no Google Cloud, origens autorizadas, callbacks local/homologação/produção e rotação de segredo. A configuração real continua externa ao repositório.

## Testes e auditorias

- 18 arquivos Vitest, 59 testes: PASS.
- E2E desktop/mobile existentes: 22/22 PASS.
- lint: PASS.
- typecheck: PASS.
- build: PASS, incluindo as rotas OAuth.
- migração limpa: PASS, 34 migrações.
- migração incremental: PASS, 34 migrações.
- política de senha válida e inválida: coberta por testes unitários.
- state/nonce, cookie HttpOnly e redirect Google: cobertos por testes unitários.
- sessões existentes, recuperação, redefinição e logout: regressão aprovada pela suíte.

Não foram alterados Radar, consentimento, snapshots, motor matemático, reputação ou regras de produto.

## Limitações externas

O login Google só fica operacional após cadastrar credenciais válidas no Google Cloud e configurar os três valores no ambiente. Não foram usadas contas Google reais nos testes. Homologação e produção ainda exigem configuração de redirect URI HTTPS, secret manager e revisão operacional dos limites do provedor.

## Arquivos principais

- src/lib/auth/google.ts
- src/lib/auth/service.ts
- src/components/AuthForm.tsx
- rotas em src/app/api/v1/auth/google/
- src/app/api/v1/auth/providers/
- src/app/api/v1/auth/change-password/
- prisma/schema.prisma
- prisma/migrations/20260924040000_google_auth_identity/migration.sql
- tests/unit/auth-google-password.test.ts
- .env.example
- README.md

Usuários suspensos, produção pública e operação comercial continuam protegidos pelas regras e configurações existentes.

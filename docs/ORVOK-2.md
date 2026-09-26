# ORVOK 2

Redesenho completo da interface e correção das camadas de dados e API para que tudo funcione de ponta a ponta com dados reais.

## Rodar localmente com dados de demonstração

```powershell
corepack pnpm install --frozen-lockfile
./scripts/local-db.ps1
corepack pnpm db:migrate
corepack pnpm db:provision:local
corepack pnpm db:seed:demo        # catálogo de teste, avisos aprovados, admin@orvok.test / Orvok#Admin2026
corepack pnpm dev
```

`db:seed:demo` só roda em bancos terminados em `_dev` ou `_test` e nunca em staging ou produção.

## Testes

| Comando | O que faz |
|---|---|
| `pnpm test:e2e` | 105 verificações pela API: jornada do Radar, Mundo, social, admin, links de convite e limites de privacidade. `SIM_KEEP=1` mantém os consentimentos para deixar uma base de demonstração rica. |
| `python3 scripts/ui-smoke.py` | 14 verificações num navegador real: cadastro, gabarito clicando, estúdio de convite, aceite pelo link no celular, consentimento, previsões, encontro, Ctrl+K e ausência de erros de console. Requer `pip install playwright && playwright install chromium`. |

Ambos precisam do app rodando (`BASE_URL`, padrão `http://localhost:3000`) e do seed aplicado.

## Migrações novas (aplique com `pnpm db:migrate` e depois `pnpm db:provision:reapply`)

| Migração | Motivo |
|---|---|
| `20260925000000_radar_invite_by_email` | Pedido do Radar pelo e-mail verificado, sem expor a tabela de identidades. |
| `20260925010000_admin_user_directory` | Admin e moderador leem a lista de usuários; só admin muda o status. Antes a lista mostrava só a própria conta e a suspensão não tinha efeito. |
| `20260925020000_policy_helper_grants` | As políticas de Social e Mundo chamavam funções sem permissão para o papel da aplicação: tudo retornava 403. |
| `20260925030000_radar_opportunity_causality` | Só lista oportunidades que o banco aceita (resposta posterior ao consentimento). Antes toda previsão dessas falhava com 422. |
| `20260925040000_operational_audit_policies` | A auditoria aceitava só 4 ações, bloqueando todas as ações administrativas e a criação de grupos. |
| `20260925050000_world_prediction_column_case` | `confirmedAt`/`createdAt` tinham sido criadas em minúsculas: toda previsão do Mundo dava erro 500. |
| `20260925060000_radar_share_links` | Links de convite para pessoas fora do ORVOK. |

`scripts/provision-runtime-roles.ts` também foi corrigido: o `REVOKE ALL` apagava os privilégios de Social, Mundo e catálogo a cada provisionamento.

## Endpoints novos

`GET /people`, `GET /radar/encounter`, `GET /radar/made`, `POST /radar/answers/reconfirm`, `GET|POST /radar/share-links`, `POST /radar/share-links/:id/revoke`, `POST /radar/share-links/redeem`, `GET /world/predictions`, comentários de eventos e posts, `GET /social/group-invites`. Pedidos do Radar e convites de grupo aceitam `{ email }`. Públicos: `/c/:code` (página do convite, com Open Graph) e `/api/share/:code/card?format=og|square|story` (cartão PNG).

## Sistema visual

Azul-noite mineral com textura sutil. Uma cor fixa por perspectiva: pêssego para Você, teal para Pessoas, lavanda para Mundo. Tipografia Bricolage Grotesque (títulos) e IBM Plex Sans (interface). A peça-assinatura é o radar interativo (`src/components/ui/Instrument.tsx`), que segue o cursor e, no encontro, posiciona cada pessoa pela quantidade de acertos. Cards com luz que acompanha o cursor (`Spotlight`), barra superior em vidro fosco, busca de comandos com Ctrl+K. Tokens em `src/app/globals.css`.

## Configuração de produção

- `APP_URL` com o domínio real: aparece nos cartões de convite e nas prévias do WhatsApp e do Facebook.
- Pontuações matemáticas continuam desligadas pelas flags existentes; o encontro mostra acertos por pergunta, sem nota.

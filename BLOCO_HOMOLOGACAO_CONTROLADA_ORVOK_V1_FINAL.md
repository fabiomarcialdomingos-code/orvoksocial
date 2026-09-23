# Bloco de Homologação Controlada ORVOK V1

**Data:** 2026-09-22  
**Escopo:** validação técnica local em banco isolado e com fixtures `TEST_ONLY`.  
**Status:** validação parcial; não autoriza usuários reais, catálogo oficial, publicação matemática ou operação comercial.

## Objetivo e alterações

Foi executada a validação operacional prevista pelos gates do Radar e do pacote de homologação. Não foram alteradas regras de negócio, schema Prisma, migrações, fórmulas ou telas. Foi criado apenas o backlog visual obrigatório [`BACKLOG_CORRECOES_VISUAIS_ORVOK_V1.md`](BACKLOG_CORRECOES_VISUAIS_ORVOK_V1.md), preservando os achados para uma etapa visual posterior.

## Evidências aprovadas

| Verificação | Resultado |
|---|---|
| `corepack pnpm lint` | PASS |
| `corepack pnpm typecheck` | PASS |
| `corepack pnpm db:validate` | PASS |
| `corepack pnpm test` | PASS — 16 arquivos, 51 testes |
| `corepack pnpm db:smoke` | PASS — PostgreSQL 18.6, 30 migrações |
| Limites do runtime | PASS — DML negado, papéis separados, sessão/revogação e `search_path` |
| Limites de leitura | PASS — hash, ator próprio/cruzado, sessão revogada e falsificação de auditoria |
| Concorrência Radar | PASS — lock da resposta do alvo e rejeição de duplicidade |
| Hardening Radar | PASS — vínculo A/B do aviso e RLS direto do runtime |
| Migração limpa | PASS — 30 migrações |
| Migração incremental | PASS — 30 migrações e grants legados preservados |
| Backup/restauração | PASS — contagens de registros Radar preservadas |
| `corepack pnpm build` | PASS — Next.js 16.3.6, 31 rotas |

## E2E

A suíte Playwright de 22 casos foi iniciada em ambiente local. Os cenários de landing, navegação mobile, skip link, overflow, foco e menu mobile passaram. Foram observadas falhas nos cenários de Radar vazio/aviso, convite e snapshot, consentimento, links de e-mail e fluxo de duas contas; a execução não alcançou um resumo final confiável nesta sessão. Esses casos dependem de fixtures/API e ambiente autenticado e permanecem bloqueadores de homologação funcional. Não foram tratados como defeitos visuais nem corrigidos neste bloco.

## Auditoria e segurança

As verificações de banco confirmaram separação de papéis, RLS, ausência de leitura cruzada, ordem temporal, concorrência e preservação de backup. O build e os testes unitários/integrados permanecem verdes. Nenhum segredo, pergunta oficial ou resultado matemático foi publicado.

## Backlog visual

O backlog contém **6 problemas visuais históricos**, classificados por tela, severidade e impacto. Todos foram encontrados na inspeção anterior e já estavam corrigidos antes deste bloco; permanecem registrados para regressão e revisão posterior. **Quantidade encontrada neste bloco: 0 novos problemas visuais; quantidade preservada no backlog: 6.** Nenhum item foi descartado ou substituído.

## Bloqueios remanescentes

- E2E autenticado/fixtures não concluiu todos os cenários.
- Perguntas e aviso continuam `CANDIDATE`/`TEST_ONLY`.
- Revisão jurídica de retenção, exclusão e consentimento continua pendente.
- Não há CI remoto configurado.
- Estimador relacional formal, calibração de IC e publicação de métricas continuam bloqueados.
- Usuários reais, Score, RadarScore, ranking e reputação matemática continuam bloqueados.

## Recomendação

Não liberar homologação com usuários reais. Corrigir primeiro as falhas de fixtures/API da suíte E2E e repetir o gate completo em ambiente isolado. A etapa exclusiva de correção visual deve consumir o backlog registrado somente após a conclusão dos blocos funcionais e matemáticos.

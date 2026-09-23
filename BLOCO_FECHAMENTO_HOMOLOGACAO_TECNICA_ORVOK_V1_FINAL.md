# Fechamento Técnico da Homologação Controlada ORVOK V1

**Data:** 2026-09-22  
**Escopo:** correção das falhas técnicas restantes da homologação local controlada.  
**Status:** gate técnico local fechado; não autoriza usuários reais, operação comercial, catálogo oficial, aprovação jurídica ou infraestrutura hospedada.

## Falhas E2E encontradas e correções

1. **Origem local não autorizada:** o servidor Next.js bloqueava a hidratação quando o Playwright acessava `127.0.0.1`. Corrigido com `allowedDevOrigins: ["127.0.0.1"]` em `next.config.ts`.
2. **Conexão de banco ausente nos fixtures reais:** os ambientes locais usam `APP_DATABASE_URL`/`AUTH_DATABASE_URL`, enquanto os testes reais dependem de `DATABASE_URL`. O `playwright.config.ts` agora herda a conexão de owner somente quando `DATABASE_URL` não está definido.
3. **Condições de corrida entre workers:** os E2E compartilham um banco isolado para fixtures, limpeza e locks temporais. O Playwright foi configurado com `workers: 1`, tornando a execução determinística.

Nenhuma regra de negócio, fórmula, threshold, γ, shrinkage, Score, RadarScore, ranking, reputação ou componente visual foi alterado.

## Fluxos autenticados validados

O teste real passou integralmente com duas contas sintéticas:

`convite → aceite → apresentação do aviso → consentimento → respostas próprias → previsão → confirmação → snapshot imutável → reciprocidade → revogação → remoção da oportunidade → exportação → solicitação de exclusão`.

Também foram verificados notificações, idempotência, bloqueios temporais, concorrência, leitura cruzada, auditoria e tentativa de mutação de snapshot.

## Testes executados

| Área | Resultado |
|---|---|
| `corepack pnpm lint` | PASS |
| `corepack pnpm typecheck` | PASS |
| `corepack pnpm test` | PASS — 16 arquivos, 51 testes |
| `corepack pnpm test:e2e` | PASS — 22/22, um worker |
| Fundação + Radar UI | PASS — 21/21 |
| Jornada Radar autenticada | PASS — 1/1 |
| `db:validate` e `db:smoke` | PASS — PostgreSQL 18.6, 30 migrações |
| Migração limpa | PASS |
| Migração incremental | PASS |
| Backup/restauração | PASS, contagens preservadas |
| Runtime boundary | PASS |
| Read boundary | PASS |
| Radar RPC | PASS |
| Radar hardening | PASS |
| Concorrência Radar | PASS |
| Build Next.js | PASS — 31 rotas |

## Auditorias independentes

- **Arquitetura/API:** contratos e origem de teste preservados; endpoints protegidos continuam exigindo sessão e autorização.
- **Autenticação:** cadastro/login/logout e sessão verificada passaram no E2E real.
- **Banco/RLS:** DML do runtime negado, papéis separados, leitura cruzada impedida, sessão revogada e `search_path` verificados.
- **Segurança:** SQLi, falsificação de hash/auditoria, bypass de consentimento, duplicidade e concorrência cobertos pelos verificadores existentes.
- **Privacidade/LGPD:** exportação própria, pedido de exclusão auditado e ausência de exposição de gabarito/vetor verificados; política jurídica continua provisória.
- **Frontend/acessibilidade/mobile:** 21 E2E de fundação/Radar passaram, incluindo foco, labels, navegação mobile e larguras de 320px a desktop.
- **Performance básica:** suíte serial completa em 26,6s; rotas estáticas compiladas; limites/paginação existentes preservados.
- **Observabilidade/auditoria:** concessões, revogações, bloqueios e ações críticas permanecem auditadas.
- **Auditoria adversarial:** nenhuma falha crítica ou alta permaneceu aberta.

## Banco, migrações, RLS e recuperação

Há 30 migrações aplicadas. Migração limpa, incremental e `db:validate` passaram. Backup/restauração em banco isolado preservou migrações e contagens dos registros Radar. Os testes de runtime, leitura, RPC, concorrência e hardening passaram sequencialmente; uma execução paralela anterior apresentou divergência transitória e foi repetida de forma determinística com sucesso.

## CI local e remoto

O workflow `.github/workflows/ci.yml` contém instalação congelada, migrações, provisionamento de papéis, verificações RLS/Radar, lint, typecheck, testes, build e E2E. A cadeia equivalente foi executada localmente com sucesso. `git remote -v` não possui remoto configurado; portanto CI remoto, branch protection e artefatos hospedados continuam não validados.

## Itens visuais preservados

`BACKLOG_CORRECOES_VISUAIS_ORVOK_V1.md` foi preservado integralmente. O backlog contém **6 itens históricos** e **nenhum novo item visual** neste bloco. Não foram feitas correções visuais, substituições de telas ou alterações de layout.

## Riscos e bloqueios restantes

- Usuários reais e operação comercial continuam bloqueados.
- Perguntas oficiais e aviso final ainda não foram aprovados.
- Revisão jurídica de consentimento, retenção, exclusão e anonimização permanece pendente.
- CI remoto e infraestrutura hospedada não estão disponíveis.
- Estimador relacional formal, calibração estatística de IC e publicação de métricas permanecem bloqueados conforme o Motor Matemático V1.
- O backlog visual aguarda bloco posterior exclusivo.

## Arquivos alterados

- `next.config.ts` — origem local de desenvolvimento permitida para E2E.
- `playwright.config.ts` — conexão de owner fallback e workers serializados.
- `BLOCO_FECHAMENTO_HOMOLOGACAO_TECNICA_ORVOK_V1_FINAL.md` — este relatório.

O backlog visual não foi alterado.

## Recomendação

O ambiente está apto para homologação técnica controlada somente com contas sintéticas, fixtures `TEST_ONLY` e banco isolado. Não liberar usuários reais ou operação comercial até obter aprovação documental/jurídica, CI remoto, infraestrutura hospedada e decisões oficiais do catálogo e do aviso.

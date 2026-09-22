# Rastreabilidade inicial — Fase 0

A matriz completa R01–R43, com origem, prioridade, módulo, dados, teste futuro e estado, está em [`ORVOK_DIAGNOSTICO_PRE_IMPLEMENTACAO_V1.md`](../ORVOK_DIAGNOSTICO_PRE_IMPLEMENTACAO_V1.md). Os 43 IDs são grupos de requisitos, não contagem de regras atômicas. Não há matriz anterior verificável no novo repositório.

| ID técnico | Origem              | Entrega da Fase 0                       | Evidência exigida                   | Estado                        |
| ---------- | ------------------- | --------------------------------------- | ----------------------------------- | ----------------------------- |
| F0-01      | 09 §3; 10 §6; 11 §5 | Stack, versões e lockfile               | instalação congelada e build        | Verificado localmente         |
| F0-02      | 09 §§4–5,27–28      | Estrutura, ambientes e migrations       | validação Prisma e `migrate deploy` | Verificado localmente         |
| F0-03      | 09 §§23–24; 10 §29  | Segredos ignorados e PostgreSQL isolado | `git check-ignore`, conexão e smoke | Verificado localmente         |
| F0-04      | 09 §§25,30; 10 §22  | Lint, typecheck, Vitest e Playwright    | comandos verdes; smoke HTTP/DB      | Verificado localmente         |
| F0-05      | 10 §§23,27; 11 §9   | CI, hooks, ADR e relatório              | CI YAML, commit identificável       | Preparado; commit ao encerrar |

IDs de produto R01–R43 permanecem sem implementação nesta fase. D1, D2 e L1–L6 não são resolvidos por F0-01–F0-05.

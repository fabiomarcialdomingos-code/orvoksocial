# Backlog de correções visuais ORVOK V1

Registro contínuo de falhas visuais, de layout, responsividade, UX e consistência de componentes encontradas durante os blocos funcionais. Este backlog não autoriza correções durante blocos funcionais ou matemáticos.

| ID | Tela/área | Severidade | Impacto | Achado | Estado | Evidência |
|---|---|---:|---|---|---|---|
| VIS-001 | `/onboarding` | Média | Navegação | A rota solicitada para inspeção não existia e retornava 404. | Corrigido antes deste backlog; manter histórico para regressão | Inspeção visual local de 22/09/2026 |
| VIS-002 | `/reciprocidade` | Média | Navegação | Não havia rota dedicada para o estado estrutural de reciprocidade; a informação estava apenas integrada ao Radar. | Corrigido antes deste backlog; manter histórico para regressão | Inspeção visual local de 22/09/2026 |
| VIS-003 | `/previsao` | Média | Navegação | Não havia rota dedicada para iniciar uma previsão estrutural; o fluxo estava integrado a eventos/Radar. | Corrigido antes deste backlog; manter histórico para regressão | Inspeção visual local de 22/09/2026 |
| VIS-004 | `/resultado` | Média | Navegação | Não havia rota dedicada para resultado estrutural; o acesso dependia de evento ou snapshot. | Corrigido antes deste backlog; manter histórico para regressão | Inspeção visual local de 22/09/2026 |
| VIS-005 | `/auditoria` | Baixa | Navegação e clareza | Não havia estado visual dedicado para explicar que a auditoria é restrita ao Command Center. | Corrigido antes deste backlog; manter histórico para regressão | Inspeção visual local de 22/09/2026 |
| VIS-006 | Ações de notificações, feed e tabelas | Baixa | Acessibilidade mobile | Alguns botões tinham alvos de toque menores que 44px. | Corrigido antes deste backlog; manter histórico para regressão | Auditoria a11y local de 22/09/2026 |

## Estado no início da homologação

Foram encontrados **6 itens visuais** neste ciclo histórico. **0 itens permanecem abertos** após as correções visuais registradas no commit `8cee1e7`. Nenhum item será reaberto ou alterado durante a homologação funcional sem uma etapa visual autorizada.

Falhas funcionais de fixtures/API da suíte E2E não são classificadas como defeitos visuais neste arquivo; permanecem nos relatórios de testes e no gate de homologação.

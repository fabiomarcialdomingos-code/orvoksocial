# Bloco Núcleo Social ORVOK V1 — relatório final

Data: 22/09/2026. Este bloco entrega uma fundação social executável em ambiente de homologação local e mantém os bloqueios canônicos para usuários reais. As propostas de perguntas, aviso, resolução e retenção estão em [docs/AUDITORIA_NUCLEO_SOCIAL_PROPOSTAS_V1.md](docs/AUDITORIA_NUCLEO_SOCIAL_PROPOSTAS_V1.md); nenhuma foi publicada como regra oficial.

## Decisões propostas

Foram produzidas doze perguntas candidatas `RH-C01` a `RH-C12`, com escala ordinal, opção explícita de informação insuficiente, famílias e salvaguardas contra inferência clínica. O catálogo continua `TEST_ONLY`/`CANDIDATE`; a aprovação exige decisão formal, manifesto, hashes, teste cognitivo e revisão de vieses.

Foi proposto um aviso separado para `SELF_ANSWER` e `BE_PREDICTED`, com finalidade, snapshot versionado, revogação e direitos do titular. Ele permanece candidato e não foi inserido como `APPROVED`.

O contrato de resolução proposto usa estados `DRAFT → OPEN → FROZEN → RESOLVED → REVIEWED` ou `CANCELLED`, com fonte, regra, evidência por referência protegida, versão e auditoria. Não calcula Score, Brier, ganho, γ ou reputação. No Radar, a ordem canônica continua gabarito antes da previsão; resposta posterior não reescreve snapshots.

A política operacional proposta exige motivo e trilha para revisão, correção e cancelamento, preserva versões e impede alteração histórica. A retenção/exclusão é uma política técnica provisória: classes de dados, jobs idempotentes, exceções legais e tratamento de backups dependem de parecer jurídico.

A homologação proposta usa quatro ciclos com contas sintéticas, banco isolado, dados `TEST_ONLY`, evidência de logs, testes de autorização, acessibilidade, concorrência, restauração e ausência de vazamento. Não autoriza pessoas reais.

## Implementado

- Perfil estrutural com nome, bio, avatar opcional, iniciais na interface e projeções de previsões/reciprocidade sem score.
- Grupos com criação, convite, aceite, membros, eventos internos, congelamento, resolução de teste e auditoria estrutural.
- Feed autenticado, comentários, reações, mensagens vinculáveis a snapshot, bloqueio e denúncia.
- Notificações de grupo e integração com inbox existente.
- Command Center visual e leitura administrativa de auditoria, com ações sensíveis ainda deliberadamente restritas ao contrato administrativo pendente.
- Rotas `/social/profile`, `/social/groups`, convites, eventos, feed, posts, comentários, reações, mensagens, bloqueios, denúncias e `/admin/audit`, todas atrás de sessão e validação Zod.
- Migrações append-only `20260923000000_social_core`, `20260923010000_social_rls_hardening` e `20260923020000_social_rls_recursion_guard`, totalizando 27 migrações.
- RLS endurecido para impedir que membros alterem objetos de outros membros; eventos exigem owner/moderator; mensagens respeitam bloqueios; denúncias só podem ser revisadas por moderator/admin.
- Telas `/perfil`, `/grupos`, `/feed`, `/notificacoes`, `/eventos` e `/admin`, com estados vazios, erro, sucesso, foco visível e layout responsivo.

## Não implementado ou incompleto

O ciclo de previsões sobre o mundo ainda não possui API completa de `evento → oportunidade → previsão → congelamento → resolução`; os modelos legados continuam estruturais. Suspensão, bloqueio temporário, redefinição administrativa de senha, resolução de denúncias e gestão completa de grupos/eventos ainda precisam de contratos administrativos formais. Não foram criados scoring, Brier, ganho, RadarScore, γ, shrinkage, consenso, ranking, ligas ou reputação matemática.

## Auditorias e achados

O auditor independente registrou achados de arquitetura, banco, API, autenticação, autorização, LGPD, segurança, moderação, frontend, design, mobile, acessibilidade, performance, testes, observabilidade, rastreabilidade e recuperação no documento de propostas. O achado alto do primeiro desenho social era permissividade de DML: membros podiam alterar objetos alheios. A auditoria seguinte encontrou risco de recursão nas políticas que consultavam `SocialGroupMember` diretamente. As migrações `20260923010000_social_rls_hardening` e `20260923020000_social_rls_recursion_guard` corrigiram autorização por owner/moderator com funções `SECURITY DEFINER` de escopo restrito; migração limpa/incremental passou. Permanecem achados altos para o Command Center operacional completo e o ciclo mundial, pois ainda não há contratos ratificados nem testes de ponta a ponta correspondentes.

## Validação executada

- `db:validate`: passou.
- `db:migrate`: passou com 27 migrações.
- `db:verify:clean-database`: passou com banco novo e 27 migrações.
- `db:verify:incremental-database`: passou preservando histórico Radar e 27 migrações.
- `db:verify:backup-restore`: passou com contagens preservadas.
- `lint`, `typecheck`, `test` e `build`: passaram; suíte existente: 13 arquivos e 37 testes.
- `test:e2e`: 22/22 passou, incluindo layouts móveis e jornada Radar real de duas contas.

Não há ainda testes E2E específicos de grupos, feed, moderação, mensagens e Command Center; por isso esses domínios não podem ser considerados homologados. Também não há CI remoto: `git remote -v` permanece vazio.

## Arquivos e commits

Arquivos principais: `prisma/migrations/20260923000000_social_core`, `prisma/migrations/20260923010000_social_rls_hardening`, `src/lib/api/social-operations.ts`, `src/app/api/v1/[[...path]]/route.ts`, páginas sociais em `src/app/{perfil,grupos,feed,eventos,notificacoes,admin}`, `src/components/SocialShell.tsx`, `docs/AUDITORIA_NUCLEO_SOCIAL_PROPOSTAS_V1.md` e este relatório.

Commit anterior do Radar: `0c9f7f9497e1c028d9e156326e9c4c466fbceb50`; relatório Radar: `087f8063be8b58c65acdcd03729cb0dab3780eb0`. O commit deste bloco será registrado após a validação final do hook, junto com o commit deste relatório.

## Bloqueios e recomendação

Usuários reais continuam bloqueados até aprovação das perguntas e do aviso, revisão jurídica LGPD, contrato de resolução, políticas administrativas, testes E2E sociais, CI remoto e infraestrutura hospedada. A recomendação é aceitar esta entrega como fundação de homologação técnica local e autorizar o próximo bloco somente para fechar os contratos administrativos/mundiais e criar testes sociais completos; não abrir operação pública nem iniciar matemática de scoring.

# MVP ORVOK V1 — completude técnica e homologação controlada

Data: 22/09/2026. Esta entrega prepara uma homologação local isolada com dados `TEST_ONLY`. Não aprova perguntas, aviso jurídico, CI remoto, infraestrutura hospedada ou usuários reais.

## 1. Ciclo mundial

Foi criado o ciclo estrutural de eventos mundiais:

`evento publicado → oportunidade → previsão com confiança → confirmação → fechamento → resolução TEST/OFFICIAL/CANCELLED/VOID → histórico`.

A migração `20260923030000_world_predictions_command_center` criou categorias, eventos, oportunidades, snapshots de previsões, resoluções, comentários e reações. O trigger fecha a aceitação dez minutos antes de `closesAt`, exige confirmação posterior à previsão, congela snapshots e rejeita oportunidade de outro evento. O serviço expõe calendário paginado, criação administrativa justificada, previsão, resolução, comentários e reações. Não existe Score, Brier, ganho, consenso matemático, ranking ou reputação.

O fechamento automático é fornecido por função SQL `orvok_world_close_due`; a execução periódica do job ainda depende da infraestrutura operacional. Resoluções oficiais exigem administrador/moderador, critério e justificativa; cancelamento e anulação preservam o histórico.

## 2. Command Center

O Command Center recebeu busca/listagem paginada de usuários, métricas visuais, auditoria e ações de suspensão/habilitação com motivo. A base SQL contém `AdminAction`, RLS administrativo e trilha para criação/resolução de eventos. A tela também apresenta bloqueio temporário, redefinição de senha, denúncias e problemas em estado de teste.

Limite conhecido: as ações visuais de bloqueio temporário e redefinição de senha ainda são simulações de homologação; não há endpoint operacional completo para cada ação administrativa. Não foram criados jobs de exclusão, MFA de operador, ações em lote ou integração hospedada.

## 3. Perguntas e aviso

`docs/PROPOSTA_PERGUNTAS_RADAR_BASE_V1.md` contém as 12 perguntas `RH-B01`–`RH-B12`, opções, categorias, sensibilidade de governança, riscos de viés, versão candidata e critérios de não publicação. O status é `PROPOSTA_PARA_APROVACAO`/`CANDIDATE`; nada foi importado como `APPROVED`.

`docs/PACOTE_HOMOLOGACAO_CONTROLADA_ORVOK_V1.md` contém o aviso candidato, finalidade, fluxo de consentimento, critérios de aceite, checklist de release/rollback, observabilidade, backup e os quatro ciclos H1–H4. A revisão jurídica de base legal, retenção, exclusão, menores, backups e transferências continua pendente.

## 4. Arquivos principais

- `prisma/migrations/20260923030000_world_predictions_command_center/migration.sql`
- `prisma/migrations/20260923040000_world_prediction_integrity/migration.sql`
- `src/lib/api/world-operations.ts`
- `src/app/api/v1/[[...path]]/route.ts`
- `src/components/WorldWorkspace.tsx`
- `src/components/CommandCenter.tsx`
- `src/app/eventos/page.tsx` e `src/app/admin/page.tsx`
- `docs/PROPOSTA_PERGUNTAS_RADAR_BASE_V1.md`
- `docs/PACOTE_HOMOLOGACAO_CONTROLADA_ORVOK_V1.md`

Total: 29 migrações versionadas.

## 5. Testes e evidências

Passaram localmente:

- `prisma validate`;
- migração normal, migração limpa e migração incremental com 29 migrações;
- backup/restauração em banco isolado, com contagens preservadas;
- lint, typecheck, build;
- 13 arquivos Vitest e 37 testes existentes;
- 22 E2E existentes do Radar/fundação, incluindo mobile e acessibilidade básica.

Os testes E2E específicos de mundo, grupos sociais e Command Center ainda não foram criados nesta entrega. Portanto, esses domínios estão prontos para execução estrutural local, mas não podem ser declarados homologados.

## 6. Auditorias

A auditoria independente cobriu arquitetura, banco, RLS, API, segurança, LGPD, frontend, UX, acessibilidade, mobile, performance, backup, CI e rastreabilidade. O achado alto de integridade da previsão — oportunidade pertencente a outro evento — foi corrigido por `20260923040000_world_prediction_integrity` e validado em migração limpa/incremental. Os riscos altos restantes são: Command Center ainda parcialmente simulado, ausência de E2E próprios dos novos domínios, job hospedado de fechamento automático e ausência de CI remoto.

## 7. CI e infraestrutura

O workflow local continua preparado para PostgreSQL, papéis separados, migração limpa/incremental, lint, typecheck, Vitest, build e E2E. `git remote -v` não retorna remoto; nenhum CI remoto, branch protection ou infraestrutura hospedada foi declarado como aprovado. Variáveis reais permanecem fora do Git; o pacote de homologação define health checks, logs sem conteúdo sensível, métricas operacionais, backup, rollback e critérios de parada.

## 8. Bloqueios para usuários reais

Continuam bloqueados: aprovação formal das 12 perguntas, aviso final e revisão jurídica; contrato ratificado de resolução/revisão/cancelamento; E2E sociais e mundiais específicos; Command Center operacional completo; job/observabilidade hospedados; CI remoto; política final de retenção e exclusão. Também continuam proibidos Score, Brier, ganho, RadarScore, γ, shrinkage, ranking e reputação matemática.

## 9. Critérios objetivos de homologação controlada

Liberar somente quando H1–H4 do pacote forem executados em banco isolado, com duas ou mais contas sintéticas, nenhuma leitura cruzada, nenhuma previsão fora da janela, confirmação antes do fechamento, resolução justificada, auditoria íntegra, backup restaurado, smoke pós-rollback, teclado/foco/mobile aprovados e zero segredo em logs. Qualquer bypass de RLS/consentimento, migração inconsistente, ação administrativa sem motivo ou vazamento interrompe a homologação.

## 10. Commit e recomendação

Commit anterior do núcleo social: `d3cb566601252956c43c73266ef7ef684d61b052`. O commit desta entrega será registrado após o hook final de lint, typecheck e testes.

Recomendação: aceitar o pacote como preparação técnica de homologação local controlada. Não liberar usuários reais. O próximo bloco deve fechar os testes E2E dos novos domínios, tornar o Command Center operacional com reautorização/MFA, configurar CI e infraestrutura hospedada e obter as aprovações jurídica, documental e de resolução antes de qualquer abertura.

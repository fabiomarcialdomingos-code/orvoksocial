# Pacote de homologação controlada ORVOK V1

Status: checklist operacional para ambiente isolado. Não é autorização de usuários reais, catálogo oficial, operação comercial ou aprovação jurídica.

## Aviso candidato

“Você está autorizando o ORVOK a registrar sua resposta na versão identificada do instrumento Radar e, neste convite, a permitir que o previsor indicado registre uma previsão sobre essa resposta. O registro guarda a versão do instrumento, a versão deste aviso, o horário e um snapshot imutável. O previsor não verá sua resposta antes do momento permitido pelas regras vigentes. Você pode recusar ou revogar o consentimento para impedir novas operações; os efeitos sobre registros históricos, auditoria, segurança e obrigações legais dependem da política aplicável. Você pode solicitar acesso, exportação e exclusão pelos canais do ORVOK. O Radar não é diagnóstico clínico, não mede saúde mental e não deve ser usado em decisões de crédito, emprego, seguro ou efeitos legais. Leia o texto completo e escolha conscientemente “Concordo” ou “Não concordo”.

Este texto é `CANDIDATE`, precisa de revisão jurídica e não pode ser associado a `APPROVED` sem versão, hash, finalidade, base legal, controlador, canal de direitos e decisão formal. A apresentação deve ser vinculada ao convite e finalidade; recusa não cria grant.

## Ciclos de homologação

| Ciclo | Dados | Saída mínima |
|---|---|---|
| H1 Identidade e direitos | contas sintéticas, e-mail fake, exportação e pedido de exclusão | nenhuma sessão cruzada; pedidos auditados |
| H2 Radar | dois ou três usuários sintéticos, catálogo/aviso `TEST_ONLY` | convite → aceite → aviso → consentimento → respostas → snapshot; sem vazamento |
| H3 Social e grupos | grupos isolados e conteúdo sintético | membro/invite/feed/comment/reaction/message/block/report autorizados |
| H4 Mundo e administração | eventos de teste e operador segregado | ciclo de evento e ações administrativas auditadas; sem score |

Critério de parada imediato: leitura cruzada, bypass de consentimento ou RLS, segredo em log, mutação de snapshot, ação administrativa sem motivo/auditoria, migração não reprodutível, restauração inconsistente, item de pergunta não aprovado exposto, falha crítica de acessibilidade ou ausência de evidência de rollback.

## Checklist de release local

- [ ] Branch e commit identificados; working tree limpo.
- [ ] Node/pnpm/PostgreSQL fixados e lockfile verificado.
- [ ] `.env*` real, credenciais, dumps e `Chaves.txt` fora do Git.
- [ ] Migração limpa e incremental, checksums e RLS verificados.
- [ ] Lint, typecheck, unit/integration/API/E2E, acessibilidade e mobile aprovados.
- [ ] Backup criptografado criado e restauração em banco isolado comprovada.
- [ ] Health check, logs estruturados, métricas de erro/latência/fila e alertas definidos.
- [ ] Runbook de rollback: pausar tráfego, preservar auditoria, restaurar backup compatível, reaplicar migrações, validar smoke e reabrir somente após aprovação.

## CI/CD

O workflow local deve executar instalação congelada, migração limpa/incremental, provisionamento de papéis limitados, seed/import de fixtures somente antes dos testes que as exigem, RLS/boundary, lint, typecheck, testes, build e E2E. Sem remoto Git configurado, nenhum resultado remoto deve ser declarado. Antes de homologação hospedada, configurar remoto, secrets manager, branch protection, revisão obrigatória e retenção de artefatos sem dados pessoais.

## Observabilidade e recuperação

Monitorar 5xx, latência por rota, autenticação, tentativas bloqueadas, fila SMTP, notificações, pedidos de direitos, jobs, tamanho do banco e falhas de backup. Logs devem conter correlação, ator pseudonimizado, ação e resultado; não conter senha, token, gabarito, vetor de probabilidade ou texto privado. Backup deve ser testado com a mesma linha principal do PostgreSQL, em banco isolado, com verificação de contagem de migrações, smoke e grants.

## Auditoria independente

| Área | Evidência exigida | Achado que bloqueia |
|---|---|---|
| Arquitetura/API | contrato, schema, autorização, idempotência, paginação | endpoint protegido só no frontend |
| Banco/RLS | migrações e testes A/B/C | leitura cruzada ou DDL pelo runtime |
| Segurança | abuso, CSRF, XSS, SQLi, enumeração, concorrência | bypass reproduzível |
| LGPD | finalidade, minimização, consentimento, exportação, exclusão | tratamento real sem parecer |
| Admin/moderação | RBAC, motivo, reautorização, auditoria | ação destrutiva sem confirmação |
| Mundo | estados, janela, fonte, resolução, cancelamento | transição fora de ordem ou resultado não auditado |
| Frontend/a11y/mobile | teclado, foco, contraste, viewport | falha crítica ou vazamento visual |
| Performance | limites, paginação, consultas e carga básica | timeout ou consulta sem limite |
| Recuperação | backup/restore e rollback | restauração não reproduzível |
| Rastreabilidade | requisito → código → teste → evidência | regra sem teste |

## Decisões ainda necessárias

As perguntas e o aviso acima permanecem propostas. Também permanecem pendentes o parecer jurídico de retenção/exclusão, a decisão formal de resolução e revisão/cancelamento, a configuração de infraestrutura hospedada e a semântica definitiva de match/notificações. A homologação recomendada é somente com contas sintéticas e banco isolado até essas decisões.


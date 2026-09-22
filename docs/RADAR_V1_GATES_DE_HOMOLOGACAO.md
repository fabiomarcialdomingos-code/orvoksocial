# Gates do Radar Humano Social V1 — ambiente controlado

O núcleo Radar deste bloco só pode ser exercitado com dados e pessoas de teste. `TEST_ONLY` identifica perguntas e avisos fictícios; não é uma versão aprovada do instrumento. A ordem canônica é convite, aceite, apresentação do aviso, consentimento, gabarito do alvo, previsão, resolução e avaliação. O snapshot preserva a versão do gabarito vigente antes da previsão. Uma resposta posterior não reescreve nem reavalia silenciosamente aquele snapshot.

## Homologação técnica

- [ ] Executar migração limpa e incremental; conferir quantidade e checksums no banco.
- [ ] Executar lint, typecheck, testes unitários, integração, contrato, E2E e build com banco isolado.
- [ ] Testar dois usuários verificados: convite, aceite, aviso, consentimento, respostas próprias, previsão e snapshot.
- [ ] Rejeitar duplicação indevida, convite expirado quando houver `expiresAt`, auto convite, previsão anterior ao aceite/gabarito, previsão depois de revogação e escrita direta com papel de runtime.
- [ ] Apresentar aviso no contexto do convite A e rejeitar seu uso para conceder consentimento no convite B, mesmo com o mesmo alvo e a mesma sessão.
- [ ] Confirmar por SQL direto que o papel de runtime não lê perguntas candidatas, fixtures desabilitadas ou avisos de teste fora do ambiente autorizado.
- [ ] Confirmar que a resposta do alvo não vaza ao previsor antes do momento permitido; sem Score, RadarScore, γ, consenso ou ranking na API ou UI.
- [ ] Testar leitura cruzada, revogação durante corrida, snapshot imutável, idempotência e auditoria de bloqueios.
- [ ] Concorrer nova versão de gabarito do alvo e previsão: a referência congelada deve corresponder à versão vigente na ordem serial da gravação, sem trocar o gabarito de snapshots antigos.
- [ ] Testar exportação do próprio titular e solicitação de exclusão sem supor eliminação automática.
- [ ] Confirmar atualização de notificações apenas para o destinatário, sem texto de gabarito ou vetor.
- [ ] Testar teclado, foco, leitor de tela, contraste e larguras de 320 px a desktop.
- [ ] Ensaiar backup/restauração em banco isolado e conferir migrações, snapshots, grants, revogações e auditoria.
- [ ] Verificar que nenhum segredo e nenhuma fixture pessoal está versionada; observar logs e métricas sem conteúdo sensível.
- [ ] Repetir testes em CI remoto apenas quando houver remoto configurado e execução observável.

## Revisão jurídica antes de usuários reais

- [ ] Aprovar o texto e a finalidade de cada aviso de consentimento, distinguindo `SELF_ANSWER` e `BE_PREDICTED`.
- [ ] Revisar base legal, prova de apresentação, revogação, visibilidade e direitos do titular.
- [ ] Definir prazo e procedimento de retenção, eliminação, anonimização, exceções e cópias de backup.
- [ ] Revisar acesso de menores, transferência/fornecedores, resposta a incidentes e canal de solicitações.
- [ ] Aprovar a política técnica provisória como política operacional revisada; até lá, pedidos de exclusão permanecem solicitações auditadas.

## Publicação do catálogo oficial

- [ ] Receber aprovação expressa das 12 perguntas, opções, ordem, famílias/dependências e versão do instrumento.
- [ ] Validar manifesto oficial assinado/aprovado e hashes canônicos; recusar 11/13 itens, duplicações e alteração silenciosa de texto ou opção.
- [ ] Validar linguagem sem inferência clínica/diagnóstica e verificar baseline e regras de elegibilidade exigidas pela decisão D09 antes da publicação.
- [ ] Executar testes de não vazamento do gabarito e de migração/versionamento de catálogo.
- [ ] Autorizar separadamente o desbloqueio em ambiente real. Fixtures `TEST_ONLY` nunca são promovidas automaticamente.

## Pendências de produto

Expiração padrão de convite, gatilhos e canais definitivos de notificação, semântica de match/reciprocidade e momento da revelação/resolução precisam de contrato ratificado antes da operação real. O pedido de avaliação quando o alvo responder não altera a ordem canônica de gabarito anterior à previsão.

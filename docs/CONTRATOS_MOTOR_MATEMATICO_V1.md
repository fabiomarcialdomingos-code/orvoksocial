# Contratos do Motor Matemático V1

Estado: contrato técnico interno para teste controlado. Este documento não autoriza publicação de Score, RadarScore, ranking, reputação matemática ou operação com usuários reais.

## Limites de publicação

O motor pode persistir cálculos privados, versionados e reproduzíveis quando `MATH_ENGINE_ENABLED=true`. As flags `SCORE_PUBLICATION_ENABLED`, `RADAR_SCORE_PUBLICATION_ENABLED`, `RANKING_ENABLED`, `MATHEMATICAL_REPUTATION_ENABLED`, `OFFICIAL_RADAR_CATALOG_ENABLED` e `REAL_USER_HOMOLOGATION_ENABLED` permanecem `false` nos exemplos de todos os ambientes. Uma configuração que abra qualquer gate deve falhar no bootstrap da aplicação até existir uma decisão de release registrada.

Resultados internos não podem ser retornados por endpoints de perfil, feed, Radar, grupos, notificações ou administração. APIs externas devem expor apenas estado operacional, identificadores opacos e mensagens genéricas de indisponibilidade. Fórmulas, parâmetros sensíveis, vetores de respostas, gabaritos e dados individuais não entram em logs, métricas ou erros.

## Contrato de cálculo

Cada cálculo persistido precisa carregar `engineVersion`, `instrumentVersion`, `baselineVersion`, parâmetros serializados com hash, `n_eff`, estado de evidência, margem de incerteza, intervalo de confiança quando aplicável, instante de cálculo e referência aos snapshots de entrada. A entrada é somente leitura; correções geram novo snapshot e novo registro de auditoria. Nenhum registro histórico pode ser atualizado ou apagado para alterar um resultado anterior.

O mundo usa os estados `INITIAL` para `n_eff=0`, `EVALUATION` para `1 <= n_eff <= 96` e `SUFFICIENT` para `n_eff >= 97`. O Radar usa `INITIAL` para `0 <= n_eff <= 43`, `EVALUATION` a partir de `n_eff >= 44` enquanto os critérios adicionais não forem atendidos, e `SUFFICIENT` somente com `n_eff >= 90`, `R_A >= 10`, `R_B >= 10` e IC95% de `gamma_ij` excluindo zero. Esses estados não são equivalentes a uma autorização de publicação.

O consenso usa apenas previsões elegíveis no instante do snapshot, deixa a própria previsão fora do consenso de referência e mantém snapshots leave-one-out separados. O reprocessamento informa a versão do algoritmo e preserva a linhagem anterior. Alterações de resolução criam uma correção versionada, sem mutação silenciosa.

## Contrato de privacidade

Dados brutos de resposta, relação previsor-alvo, gabarito, parâmetros e resultados internos são privados por padrão. Acesso administrativo exige papel, finalidade e motivo auditado. Exportações seguem o contrato de direitos de dados e não expõem material de terceiros sem autorização. A política de retenção e exclusão permanece provisória até revisão jurídica; o sistema registra solicitações sem inventar eliminação automática.

## Critérios de aceitação

- repetir o cálculo com os mesmos snapshots e versões produz o mesmo resultado;
- qualquer mudança de entrada ou algoritmo produz uma nova versão identificável;
- uma previsão nunca participa do próprio consenso de referência;
- estados de evidência obedecem aos limiares canônicos;
- resultado interno não aparece em API, UI, log ou métrica enquanto os gates estiverem fechados;
- revogação de consentimento bloqueia exposição futura sem apagar a trilha necessária;
- dados extremos, ausência de dados, duplicidade e concorrência são rejeitados de forma determinística;
- correções e reprocessamentos são auditáveis e não alteram snapshots anteriores.

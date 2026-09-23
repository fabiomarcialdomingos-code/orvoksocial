# Motor Matemático ORVOK V1 — relatório final

Data: 22/09/2026. O motor foi entregue como cálculo interno versionado para banco isolado. Nenhum resultado matemático é exposto ao produto, ranking ou reputação; todas as flags de publicação permanecem fechadas.

## Implementação e fórmulas

`src/lib/math-engine.ts` é a implementação canônica; `src/lib/math/engine.ts` é apenas fachada compatível para os testes. O motor inclui:

- Brier binário `BS=(p-y)^2` e multiclasses `BS=Σ(p_k-o_k)^2`;
- baseline climatológico empírico e ganho `baseline-score`;
- clipping de probabilidades em `[0,05; 0,95]`;
- consenso por média de log-odds com pesos iguais no MVP e leave-one-out com quórum operacional Q=5;
- peso temporal `exp(-λΔt)`, com `λ=ln(2)/180` e versão explícita;
- clusters candidatos, normalização e `n_eff=(Σw)^2/Σw²`;
- estado mundial `0 INITIAL`, `1–96 EVALUATION`, `≥97 SUFFICIENT`;
- estado Radar `0–43 INITIAL`, `≥44 EVALUATION`, e `SUFFICIENT` somente com `n_eff≥90`, `R_A≥10`, `R_B≥10` e IC95% de `γ_ij` fora de zero;
- DA preliminar, α, β, γ, shrinkage e IC95% como cálculo interno candidato.

O estimador relacional atualmente implementado é uma aproximação interna de integração. O documento adversarial registra que `radarGammaModel` não é estimador formal REML e não pode sustentar publicação; clusters e shrinkage permanecem candidatos versionados.

## Persistência e migrações

`20260923050000_math_engine_artifacts` cria `MathAlgorithmVersion`, `MathCalculationRun`, `MathConsensusSnapshot`, `MathScoreSnapshot` e `MathRadarSnapshot`, com parâmetros, manifestos de entrada, hashes, `n_eff`, margem, estados e triggers imutáveis. O runtime não recebe grants nessas tabelas. A sequência possui 30 migrações; migração limpa e incremental passaram.

Reprocessamentos devem criar novo `MathCalculationRun` e algoritmo; correções devem criar novo snapshot e `AuditLog`. O registro histórico não é atualizado nem excluído.

## Contratos e flags

Contratos em `docs/CONTRATOS_MOTOR_MATEMATICO_V1.md` e operação em `docs/MOTOR_MATEMATICO_OPERACAO_V1.md`. Flags fechadas: `SCORE_PUBLICATION_ENABLED`, `RADAR_SCORE_PUBLICATION_ENABLED`, `RANKING_ENABLED`, `MATHEMATICAL_REPUTATION_ENABLED`, `OFFICIAL_RADAR_CATALOG_ENABLED` e `REAL_USER_HOMOLOGATION_ENABLED`. Uma configuração que tente abrir publicação falha na validação. Fórmulas, parâmetros, vetores e gabaritos não entram em API, UI, logs ou métricas.

## Testes e simulações

Passaram 16 arquivos e 51 testes Vitest, incluindo fixtures determinísticas de Brier, baseline, ganho, consenso, leave-one-out, clipping, tempo, clusters, `n_eff`, DA, shrinkage, IC95%, estados, extremos, duplicidade e circularidade. A auditoria adversarial executa simulação Monte Carlo determinística com 2.000 consensos e verifica estabilidade, limites e amostras pequenas. `lint`, `typecheck` e `build` passaram.

Também passaram `db:validate`, migração normal, migração limpa/incremental e backup/restauração. O CI remoto não foi executado porque não há remoto Git configurado (`git remote -v` vazio). O workflow local continua preparado para instalação congelada, migrações, testes, build e E2E.

## Auditorias

As auditorias matemática/estatística, banco, arquitetura, segurança, privacidade, API, frontend, observabilidade e adversarial encontraram e corrigiram dois defeitos altos nos helpers temporais: timestamps inválidos e pesos inválidos eram descartados silenciosamente. Agora são rejeitados explicitamente. Também foi removida uma migração duplicada de mesmo timestamp antes da validação limpa.

Riscos médios permanecem: IC normal não é calibrado para amostras pequenas e deve permanecer interno; a aproximação de γ, clusters e shrinkage candidatos ainda precisam de validação formal independente antes de qualquer publicação. Não há E2E de exposição de métricas porque a publicação está deliberadamente bloqueada.

## Privacidade, segurança e operação

Os artefatos matemáticos são inacessíveis ao papel runtime e não são retornados por APIs públicas. Auditoria usa hashes opacos; observabilidade registra somente agregados por versão, estado, duração, erro, job e backup. Rollback não remove snapshots nem migrações: pausa jobs, preserva auditoria e reprocessa em banco isolado. Usuários reais, catálogo oficial, aviso jurídico, produção hospedada e retenção final LGPD continuam bloqueados.

## Arquivos e commits

Arquivos principais: `src/lib/math-engine.ts`, `src/lib/math/engine.ts`, `src/lib/math-feature-flags.ts`, `prisma/migrations/20260923050000_math_engine_artifacts/migration.sql`, testes unitários/adversariais, contratos, runbook, variáveis `.env.*.example` e rastreabilidade.

Commit anterior do MVP: `6f0f481acf80eded6fcdef8eb9becea2711ee40a`; relatório anterior: `70bad480c07e6c119a551bf612652e2939ece5c9`. O commit deste bloco será registrado após o hook final.

## Recomendação

Aceitar o motor somente como fundação interna de homologação estatística em banco isolado. Não liberar Score, RadarScore, ranking, reputação, usuários reais ou operação comercial. O próximo gate deve exigir estimador relacional formal, calibração de IC em simulações independentes, revisão jurídica, CI remoto e aprovação documental antes de qualquer exposição.

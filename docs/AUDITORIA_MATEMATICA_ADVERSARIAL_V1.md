# Auditoria matemática adversarial V1

Escopo: primitives internos em `src/lib/math/engine.ts`, com testes determinísticos e uma simulação Monte Carlo seeded em `tests/unit/math-adversarial.test.ts`. O conjunto não autoriza publicação de Score, RadarScore ou reputação.

## Evidências aprovadas

- Brier binário e multiclasses rejeitam probabilidades inválidas e reproduzem fixtures conhecidos.
- Consenso usa pooling log-odds com clip [0,05; 0,95]; leave-one-out remove explicitamente o índice do previsor.
- Estados respeitam as fronteiras Mundo 0/97 e Radar 0–43/44/90 + suporte + IC fora de zero.
- Pesos e `n_eff` permanecem finitos nos fixtures extremos; a simulação seeded de 2.000 consensos é reprodutível e mantém os valores no intervalo protegido.
- Intervalo de uma única observação retorna margem zero, sem fabricar incerteza.

## Achados encontrados e correções aplicadas

1. **Alto — corrigido — `temporalWeights` aceitava timestamps não finitos.** `times.map` produzia `NaN`, o total deixava de ser positivo e a função retornava `[]`, descartando observações silenciosamente. A função agora rejeita `times` e `now` não finitos com `INVALID_TEMPORAL_INPUT`; a regressão está coberta.
2. **Alto — corrigido — `effectiveSampleSize` convertia pesos inválidos em zero.** Pesos negativos, `NaN` ou infinito retornavam `0`, confundindo entrada inválida com ausência de evidência. A função agora rejeita esses valores com `INVALID_WEIGHTS`; conjunto vazio continua sendo `0`.
3. **Médio — `confidenceInterval95` usa aproximação normal sem registrar método/versão.** Para n pequeno, isso não é um IC calibrado. Deve permanecer interno e armazenar método, tamanho e versão; não publicar maturidade a partir dele antes da validação Monte Carlo específica do estimador relacional.
4. **Médio — `radarGammaModel` é apenas soma estrutural.** Não é estimador de `γ_ij`, não incorpora REML, dependência, shrinkage ou intervalo. Deve ser tratado apenas como ponto de integração e nunca como resultado do Radar.

## Resultado

Os testes independentes cobrem invariantes, extremos, circularidade, thresholds, clip, leave-one-out e estabilidade. Os dois achados altos foram corrigidos no motor e regressados. O IC normal para amostras pequenas e `radarGammaModel` continuam internos e não podem sustentar publicação ou maturidade; exigem validação estatística posterior e uma implementação formal do estimador relacional antes de qualquer exposição.

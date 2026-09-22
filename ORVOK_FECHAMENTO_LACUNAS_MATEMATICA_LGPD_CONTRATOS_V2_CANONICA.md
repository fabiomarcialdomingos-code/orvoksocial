# ORVOK — fechamento de lacunas V2 canônica

**Ratificação:** decisão formal do responsável do produto, 22/09/2026. **Autoridade:** adendo compatível com 00/03/M55 REV01, limitado às cláusulas abaixo. Este arquivo substitui, para interpretação futura, a V2 externa de SHA-256 `524e21a71e7f6bbb2f6639a003f96a3e64f503ff2793975dcb32d4b0bd2f84fc` e o adendo V2 contido no ZIP de SHA-256 `cdcac3e59c0a2c1042de1a5202d36a925aabe05565048d9eae4603b3aff5ff2d`. Ambos são **obsoletos, não oficiais e não utilizáveis para implementação**. Os binários permanecem íntegros como histórico. Nenhum DOCX REV01 é alterado.

## 1. Precedência e escopo

Documento 00 define precedência; 01 produto; 02 visual; 03 fórmulas e parâmetros congelados; M52–M55 fundamentação, governança e fechamento; 08–11 persistência e execução. A presente ratificação resolve as divergências dos adendos, sem promover parâmetros candidatos. A Fase 1 está autorizada **somente para preparação de modelo estrutural e contratos de dados**. Scoring, consenso, RadarScore, ranking, estimador de γ, shrinkage e telas de produto não estão autorizados.

## 2. Estados de evidência oficiais

Os únicos estados são `INITIAL`, `EVALUATION`, `SUFFICIENT`. `INSUFFICIENT_EVIDENCE` pode ser motivo operacional de ausência de Score, não quarto estado.

| Domínio | INITIAL | EVALUATION | SUFFICIENT |
| --- | --- | --- | --- |
| Radar Humano | `0 ≤ n_eff < 44` | `n_eff ≥ 44` sem todos os critérios de maturidade | `n_eff ≥ 90`, `R_A ≥ 10`, `R_B ≥ 10`, IC95% de `γ_ij` exclui zero |
| Score mundo | `n_eff = 0` | `1 ≤ n_eff ≤ 96` | `n_eff ≥ 97` |

O **44** é piso metodológico DA, não maturidade pública; **90** é o limiar relacional público. O Score do mundo pode ser exibido desde a primeira previsão resolvida **elegível**, acompanhado de estado, N e margem. M53 §53.5 continua regendo eventos sem quórum: Q<5 não produz consenso oficial, Gain ou Score público; tais eventos preservam histórico e dados de estilo autorizados. Para eventos elegíveis, aplicar leave-one-out e backfill de semeadura conforme M53. A apresentação pública não revela fórmulas internas.

## 3. Modelo relacional

Usar exclusivamente a notação do Motor Matemático V1:

```text
z_ij = μ + α_i + β_j + γ_ij + ε_ij
```

`μ` é média global, `α_i` é efeito geral do previsor, `β_j` é efeito geral do alvo, **`γ_ij` é exclusivamente o efeito específico da relação previsor–alvo**, e `ε_ij` é erro residual. O estimador deve ser cruzado e aplicar shrinkage com dados esparsos (03 §10; M52 §52.13). Esta equação não define sozinha verossimilhança, variâncias ou IC. Essas escolhas matemáticas dependem de especificação versionada, simulação e aprovação antes de qualquer implementação de γ.

## 4. Tempo, dependência e `n_eff`

O peso temporal operacional é `w_i=exp(−λΔt_i)`, `λ=ln(2)/180 dias`, com `Δt_i` em dias e versão congelada (03 §3). Agrupamentos de dependência devem impedir que observações correlacionadas sejam contadas como independentes (03 §4; M52 §52.17; M53 §53.9). A unidade de cálculo de `n_eff=(Σw)²/Σw²` deve ser definida pelo contrato estatístico versionado para clusters independentes. A proposta anterior `W_c=mean(w_i)` **não está ratificada**. Nenhum peso de cluster candidato pode ser implementado como regra oficial nesta autorização estrutural.

## 5. Estrutura de dados permitida nesta etapa

Preparar perguntas e opções versionadas, consentimentos distintos para responder e ser previsto, revogações auditáveis, respostas próprias e versões imutáveis de gabarito, previsões com snapshots imutáveis, trilhas de auditoria e enum dos três estados. Resultados e métricas futuras deverão referenciar versões e dados brutos sem sobrescrevê-los. O gabarito válido deve preceder a previsão social, que registra referência à versão vigente no momento; resultado posterior fica separado (01 §3; M52 §52.18; 08 §2). Este adendo **não** publica as 12 perguntas Radar: catálogo real ausente, somente catálogo vazio ou fixtures marcadas como teste.

## 6. Privacidade e LGPD

Consentimento para responder não equivale a consentimento para ser previsto. Convite→aceite→consentimento explícito do alvo→gabarito→previsão→resolução→avaliação. Revogação impede novas previsões e remove exposição pública/compartilhada futura do RadarScore agregado, preservando os direitos de dados conforme M52 §52.21/M55 §55.8.5. A política de prazos do fechamento V1 e das V2 obsoletas é **política técnica provisória**, não obrigação legal universal nem retenção aprovada. Finalidade, base, prazo, eliminação, backups e exceções exigem revisão jurídica antes de operação comercial. Não criar inferências clínicas ou diagnósticas.

## 7. Limites e testes de aceite

O schema estrutural pode conter identificadores, versões, estados e referências, mas nenhum valor derivado de Score, consenso, RadarScore, γ, shrinkage ou ranking. Testes devem verificar integridade de FK, opções por versão, ausência de update em snapshots, separação dos dois consentimentos, revogação registrada, gabarito ligado temporalmente, enum fechado e replay dos dados brutos. Não converter propostas anteriores de cinco pares, `/api/v1`, notificações, moderação, retenção ou peso intercluster em regras definitivas por constarem de adendos históricos. Mudança futura exige revisão formal, migration versionada e preservação de histórico.

# ORVOK — matriz de conflitos REV02 após canonização

**Data:** 22/09/2026. A decisão formal do responsável do produto ratificou a V2 canônica compatível com REV01, 03 e M55. “Resolvido” significa resolvido **documentalmente**; implementação e testes de domínio permanecem condicionados às fases autorizadas. A V2 externa anterior e o ZIP divergente são obsoletos.

| Documento/seção | Texto conflitante anterior | Regra prevalente ratificada | Correção/impacto | Status |
| --- | --- | --- | --- | --- |
| 00 §§4,6,8 | V2 externa propunha EVALUATION Radar em 30 | 00/03/M55: 0–43 INITIAL, DA piso 44, maturidade 90 + suporte + IC | V2 canônica restaurou 44; sem mudança em 00 | **Resolvido** |
| 01 §§3,9–10 | Exemplo técnico de previsão antes de gabarito; adendos não detalhavam vínculo | Gabarito e consentimento do alvo antes da previsão; três estados; direitos de dados | Contrato estrutural separa AnswerVersion e snapshot com referência temporal | **Resolvido no contrato; teste futuro** |
| 02 §§1,21 | Nenhuma regra da V2 afeta identidade visual | Visual System congelado | Sem alteração | **Resolvido** |
| 03 §§3–5,10,15–17 | V2 externa usava r_ij e 30; peso intercluster candidato | λ=ln2/180; Radar 44/90; mundo 0/1–96/97; γ_ij exclusivo da relação | V2 canônica usa γ e não aprova peso/estimador | **Resolvido quanto à autoridade; cálculo futuro pendente** |
| M52 §§52.13,52.17–21 | V1/V2 divergiam em símbolos e gabarito posterior | γ relacional de modelo cruzado; AnswerVersion válido ao prever; consentimento separado | Contrato de dados versiona resposta, consentimento e snapshot; fórmula permanece para fase matemática | **Resolvido estruturalmente** |
| M53 §§53.3,53.5,53.8–9 | M55 §55.0 podia sugerir Score sem Q | Sem consenso oficial ou Score público em evento Q<5; primeira previsão **elegível** pode exibir Score | Registrar elegibilidade como motivo, não quarto estado; scoring fora desta fase | **Resolvido documentalmente** |
| M54 §§54.1–2,54.5 | Dúvida histórica sobre entrada e classificação skill/style | 01/M55 fecham Radar como entrada; só habilidade mundo em ranking; margem/N | Nenhuma mudança | **Resolvido** |
| M55 §§55.0–55.2,55.8.5 | V2 externa: 30–43 EVALUATION; ZIP 12: Score mundo <44 INITIAL | Radar 0–43 INITIAL, ≥44 EVALUATION até 90+suporte+IC; mundo 0 INITIAL, 1–96 EVALUATION, ≥97 SUFFICIENT | V2 canônica corrige ambas; M55 intacto | **Resolvido** |
| 08 §§2,8,12–15 | `targetGroundTruth` em snapshot imutável versus gabarito versionado prévio | Resultado separado; snapshot guarda referência à AnswerVersion vigente | Schema estrutural usa FK à versão e não copia resposta ao snapshot | **Resolvido por especificação mais alta; migração/teste estrutural** |
| 09 §§8,11–12,17–19,26 | §26 enumera previsão antes da resposta; APIs só conceituais | 01 §3/M55 §55.8.5 dão ordem real; autorização server-side | Testes futuros usarão ordem oficial; nenhum endpoint nesta fase | **Resolvido quanto à ordem; API futura pendente** |
| 10 §§7,13–14,24 | Fase 1 original listava entidades além do escopo autorizado atual | Decisão formal limita agora a modelo estrutural/contratos de dados | Não declarar Fase 1 completa; scoring/consenso/RadarScore fora | **Resolvido por escopo parcial** |
| 11 §§10–11,17,21 | §21 inverte ordem gabarito/previsão; V2 externa contrariava limiar | 01/M55 prevalecem na ordem; 44/90 e γ como Motor | E2E futuro corrigido sem alterar DOCX silenciosamente | **Resolvido documentalmente** |
| README/hierarquia REV02 anteriores | Indexavam V2 externa como proposta, não decisão ratificada | README/hierarquia REV02 canônicos novos | Preservar anteriores como históricos; manifesto novo aponta únicos arquivos oficiais | **Resolvido** |
| V1 e V2 externas do fechamento | V1 propunha SUFFICIENT em 30; V2 externa EVALUATION em 30 e r_ij | V2 canônica usa 44/90 e γ_ij | Marcar obsoletas com hash, sem sobrescrita | **Resolvido** |
| ZIP divergente `12_...V2` §§2–5 e `13_...V1` | Score mundo INITIAL até 43; símbolo γ correto, porém divergência de estado/status “aprovado” | M55/03 e ratificação atual | ZIP inteiro obsoleto; SHA-256 `cdcac3e59c0a2c1042de1a5202d36a925aabe05565048d9eae4603b3aff5ff2d` | **Resolvido** |

## Pendências fora do escopo estrutural autorizado

Estimador e IC95% de γ, regra de pesos entre clusters, catálogo real das 12 perguntas, baseline coletada, API de produto, notificações, moderação, scoring e consenso requerem contratos e autorizações posteriores. A política LGPD segue provisória até revisão jurídica. Nenhuma dessas pendências autoriza inventar regra nesta etapa.

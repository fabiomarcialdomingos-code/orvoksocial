# ORVOK — relatório de canonização REV02

**Decisão formal recebida em 22/09/2026:** a versão canônica é a V2 compatível com 00, Motor 03 e M55 REV01. A V2 externa anterior e o ZIP divergente são obsoletos, não oficiais e proibidos como fonte de implementação. A decisão autoriza preparação **parcial e exclusivamente estrutural** da Fase 1; não aprova scoring, consenso, RadarScore, γ, shrinkage, ranking ou telas.

## Artefatos canônicos e correções

- `ORVOK_FECHAMENTO_LACUNAS_MATEMATICA_LGPD_CONTRATOS_V2_CANONICA.md`: Radar 0–43 INITIAL, ≥44 EVALUATION até maturidade, SUFFICIENT apenas com ≥90/R_A/R_B/IC; mundo 0 INITIAL, 1–96 EVALUATION, ≥97 SUFFICIENT. `γ_ij` é o único símbolo para efeito relacional. Score desde primeira resolução elegível com N, margem e estado; Q<5 não pontua publicamente.
- `ORVOK_HIERARQUIA_DOCUMENTAL_REV02_CANONICA.md`: precedência explícita, históricos obsoletos identificados, 00/03/M55 preservados.
- `README_ORVOK_CODEX_REV02_CANONICO.md`: ordem de leitura e escopo parcial autorizado.
- `MATRIZ_CONFLITOS_REV02_CANONICA.md`: confronto 00–11, V1/V2 antigas e ZIP; indica conflitos resolvidos documentalmente e matemática futura pendente.
- `docs/RASTREABILIDADE_INICIAL.md`: F1S-01–F1S-04 ligados a R01–R43 e limiares oficiais.

**Proveniência:** V2 externa obsoleta SHA-256 `524e21a71e7f6bbb2f6639a003f96a3e64f503ff2793975dcb32d4b0bd2f84fc`; ZIP obsoleto `cdcac3e59c0a2c1042de1a5202d36a925aabe05565048d9eae4603b3aff5ff2d`; adendo `12_...V2.md` dentro do ZIP `91a4d894341e2cdcf62d4651247747bec1525b3ec468081d30d5fae4b5b8db63`. O ZIP é obsoleto **como pacote inteiro**, ainda que algumas cláusulas internas coincidam com o Motor. O `13_...` do ZIP não concede autorização independente.

O Documento 03 mantém SHA-256 `59cdff09bb4f6c0597cdb3e1a0579ac9fcfb1b28fe75c516c0cc487b5b6c26a1` e M55 mantém `f013fea9491780d07493cea5f96bceeb6c7ba44cd3c4ad9a88c7338d41f31ef8`. Nenhum DOCX oficial foi editado. Os diffs `DIFF_REV02_EXTERNA_PARA_CANONICA.patch` e `DIFF_ZIP_V2_PARA_CANONICA.patch` permitem revisar as mudanças do texto do adendo; os arquivos obsoletos permanecem intactos.

## Limites de autoridade

O 44/90 do Radar e 0/1–96/97 do mundo são definitivos por esta decisão. A equação `z_ij = μ + α_i + β_j + γ_ij + ε_ij` usa notação exclusiva de 03. Essa ratificação **não** aprova estimador, IC numérico, pesos de clusters, catálogo real de 12 perguntas, retenção, exclusão, endpoints, notificações ou moderação. O texto `DECISOES_CONTRATOS_FASE_1_V1.md` e o Gate anterior permanecem históricos onde divergem da canonização. A política LGPD é técnica provisória e exige revisão jurídica antes da operação comercial.

## Verificações

Os 22/22 hashes do pacote REV02 anterior conferiram antes da canonização; o ZIP foi verificado por SHA-256 e seu manifesto interno 15/15. `SHA256SUMS_REV02_CANONICO.txt` é o novo índice de integridade, com arquivos antigos preservados e artefatos canônicos identificados. Sua verificação final e o hash do próprio manifesto constam do relatório de entrega.

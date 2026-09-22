# Matriz de reconciliação A01–A11 — V2

**Status geral:** proposta para aprovação, 22/09/2026. “Corrigido na V2” indica correção textual verificada, **não** aceite de produto nem autorização de código. Referências R01–R43 remetem aos 43 grupos do Gate 0.

| ID | Proposta | Documento conflitante / limite | Decisão nesta V2 | Impacto | Teste de aceitação futuro | Status |
| --- | --- | --- | --- | --- | --- | --- |
| A01 | Evento sem Q não pontua; motivo de insuficiência | M53 §53.5 apoia ausência de Score; M55 §55.0 diz Score desde primeira resolução; 00/03 fixam três estados | `INSUFFICIENT_EVIDENCE` é reason code, não evidenceState; primeira resolução elegível é a que tem Q | R16/R20; Score, evento e perfil | Q=4 não gera Score/Gain/ranking, mantém histórico; Q=5 elegível; enum tem só 3 estados | **Parcial**: interpretação de M55 requer ratificação |
| A02 | Gabarito versionado e snapshot | M52 §52.18 exige gabarito vigente ao prever; 08 §2 separa resultado | Snapshot guarda `answer_id` válido ao prever; correção cria nova versão; resultado separado | R05/R31; Radar, dados e auditoria | Previsão antes/depois de correção usa respectivamente versão antiga/nova; replay preserva originais | **Parcial**: correção durante rodada pendente |
| A03 | Modelo relacional e evidência | V1 §3.3 usa `γ_j` para alvo e depois para relação; 03 §5/M55 §55.2 fixam 44/90/R_A/R_B/IC | `z_ij=μ+a_i+b_j+r_ij+e_ij`; `r_ij` só relação. Estados `<30`, `30–<90`, `≥90` condicionado; 44 preservado para DA | R08/R09; motor, Radar, UX | Fronteiras 29/30/43/44/89/90; sem suporte/IC fica EVALUATION; estimador reproduzível e IC calibrado | **Corrigido na V2; bloqueado** até ratificação e estimador |
| A04 | Dependência, tempo e `n_eff` | V1 §3.4 calcula Kish sobre eventos; 03 §§3–4 fixa half-life 180d; M53 §53.9 exige clusters | Cluster é unidade; `t_i=exp(−λ_v Δt_i)`, `u_i=t_i/Σ_c t`, `G_c=Σ_c u_iG_i`; `n_eff` sobre pesos intercluster; `W_c=mean(t_i)` candidato | R11/R21; motor de clusters | Tamanhos 2+1 no mesmo tempo dão `n_eff=2`; 180d dá metade do peso; testes de sobreposição e versão λ | **Corrigido conceitualmente; bloqueado**: W e atribuição pendentes |
| A05 | Baseline 1.500 e plano de coleta | 03 §7/M52 §52.17 fixam 1.500 pré-uso e exclusão do alvo; V1 adiciona estratos e ~1.800 | 1.500 congelado; estratos, controles, meta bruta e ID de base são candidatos sujeitos a piloto e privacidade | R10; calibração e dados pessoais | 1.500 válidas antes do uso, alvo excluído, hash/versão; auditoria de duplicidade e efeito de desenho | **Parcial**: amostra/itens e desenho pendentes |
| A06 | Instrumento Radar de 12 itens | 01 §3 fixa 12; 03 §5 pede evidência até 44/90; V1 só nomeia ID | Exigir textos, opções, versão, consentimento e plano de progressão antes de implementar | R02/R40; onboarding/Radar | 12 itens íntegros, ordem gabarito→previsão, progressão sem reuso indevido e versionamento | **Pendente**: conteúdo e expansão ausentes |
| A07 | Retenção, exclusão e direitos | V1 §4 propõe prazos; 01 §10/M52 §52.21 exigem direitos; 03 §§22–23/08 §25 exigem história | Prazos V1 são política técnica provisória; revisão jurídica antes da operação; sem prazo automático | R29/R30; privacidade, jobs, backup | Matriz finalidade/base/prazo por dado; exportar/revogar/excluir, backup e derivados com prova de anonimização | **Pendente bloqueante** para dados pessoais da Fase 1 |
| A08 | Visibilidade `Shared` e agregados | 01 §10 prevê três visibilidades; 03 §5.2 exige maturidade própria; V1 usa 5 pares | 5 pares é piso de privacidade candidato, nunca substituto de maturidade; matriz de acesso necessária | R28; policy/aggregate | Acesso por previsor/alvo/terceiro, revogação, supressão e prova de gates estatísticos | **Parcial**: RBAC fino e piso pendentes |
| A09 | Convenção API `/api/v1` | 09 §§17–19 só define endpoints conceituais | Prefixo candidato; schemas, auth, erros e idempotência por operação precisam de contrato | R41; API/contratos | Contract tests por endpoint, 401/403, replay idempotente, versão compatível | **Parcial**: payloads/erros ausentes |
| A10 | Gatilhos e estados de notificação | 09 §§15/18 prevê fluxo sem regras finas | Gatilhos/estados V1 são candidatos; definir canais, preferências, privacidade e emissão | R42; notificações/outbox | Deduplicação, entrega após consentimento, revogação, transições e preferência | **Parcial**: matriz de casos ausente |
| A11 | Fluxo de moderação e auditoria | 01 §§11–12/09 §22 exige moderação/RBAC; V1 nomeia estados sem permissões | Máquina de estados candidata; cada transição exige papel, motivo, prazo, recurso e revisão | R26/R32; moderação/auditoria | 403 por papel, transições ilegais, apelação, reversão e trilha imutável | **Parcial**: RBAC e apelação ausentes |

## Conflitos textuais resolvidos na proposta

- A01: quarto estado de evidência removido; falta ratificar a leitura de M55.
- A02: referência temporal do gabarito ficou inequívoca; falta regra de correção em rodada.
- A03: símbolos do efeito relacional separados; estado 30/90 e piso DA 44 distinguem conceitos.
- A04: `n_eff` não usa eventos correlacionados como unidades independentes; recência e λ versionado aparecem na fórmula.
- A07: prazos LGPD não são apresentados como política aprovada.
- A08: cinco pares não substituem maturidade estatística.

## Pendências que impedem conclusão das partes afetadas

Ratificação formal da V2/hierarquia e da leitura de M55; estimador/contração/IC numéricos de `r_ij`; decisão de peso intercluster e formação de clusters; política jurídica de dados, consentimento e exclusão; 12 itens e progressão do Radar; matriz de visibilidade; schemas de API; matrizes de notificações e moderação. A Fase 1 segue bloqueada até validação da V2 e resolução dos contratos de dados aplicáveis.

# ORVOK — Gate de validação documental REV02

**Data:** 22/09/2026. **Resultado: NÃO APROVADO; Fase 1 bloqueada.** A releitura e a verificação de integridade foram concluídas, e 14 contratos têm propostas técnicas testáveis. Os critérios para aprovar o gate ainda não se cumprem: há conflito expresso da V2 com M55 §55.2, duas linhagens V2 concorrentes, conteúdo Radar ausente e contratos que dependem de ratificação de produto e revisão jurídica. Nenhum código, schema Prisma ou migração foi alterado nesta etapa.

## 1. Escopo relido e proveniência

Foram relidos integralmente os **12 DOCX oficiais 00–11** (texto e tabelas extraídos de `word/document.xml`, confrontados com os hashes dos binários), incluindo 02 Visual System e M52/M53/M54/M55; o README e `SHA256SUMS.txt` REV01; a V1 do fechamento; todos os cinco documentos textuais REV02 externos (`ORVOK_FECHAMENTO_LACUNAS_MATEMATICA_LGPD_CONTRATOS_V2.md`, `DIFF_FECHAMENTO_V1_V2.patch`, `MATRIZ_ADENDO_A01_A11_V2.md`, `ORVOK_HIERARQUIA_DOCUMENTAL_REV02.md`, `README_ORVOK_CODEX_REV02.md`); `SHA256SUMS_REV02.txt`; `docs/RASTREABILIDADE_INICIAL.md`; e `ORVOK_DIAGNOSTICO_PRE_IMPLEMENTACAO_V1.md`. As duas imagens continuam no manifesto, com autoridade visual subordinada ao DOCX 02. `Chaves.txt` foi identificado apenas por nome/metadado, sem leitura ou cópia de conteúdo.

Foi encontrado **um arquivo novo fora das 22 entradas**: `ORVOK_SPEC_V1_FINAL_REV01_RECONCILIADO_V2.zip` (SHA-256 `cdcac3e59c0a2c1042de1a5202d36a925aabe05565048d9eae4603b3aff5ff2d`). Seu inventário interno mostra 12 DOCX e README/SHA originais byte a byte idênticos aos arquivos externos, mais `12_ORVOK_Fechamento_Lacunas_Reconciliado_V2.md`, `13_ORVOK_Relatorio_Reconciliacao_Documental_V1.md` e `SHA256SUMS_ADENDO_V2.txt`, relidos integralmente. O arquivo 12 é **outra V2**, distinta da V2 externa; o 13 chama seu adendo aprovado para implementação. O ZIP não consta do `SHA256SUMS_REV02.txt` e sua própria declaração não prova que substitui o Documento 00. Classificação: pacote alternativo não reconciliado, sem autoridade automática. O `SHA256SUMS_ADENDO_V2.txt` interno aponta hashes dos 12 DOCX, README e 12/13; seu escopo é interno ao ZIP.

## 2. Integridade

O manifesto externo REV02 contém **22 entradas; 22/22 SHA-256 conferiram** contra a pasta de referências. Também conferem os 13/13 do manifesto REV01. O ZIP foi verificado separadamente: os 12 DOCX e o README internos coincidem byte a byte com os externos; seus dois Markdown e manifesto internos têm hashes próprios, registrados abaixo. Os 22/22 não abrangem o ZIP nem os três documentos novos desta validação.

| Item | SHA-256 |
| --- | --- |
| V2 externa | `524e21a71e7f6bbb2f6639a003f96a3e64f503ff2793975dcb32d4b0bd2f84fc` |
| ZIP adicional | `cdcac3e59c0a2c1042de1a5202d36a925aabe05565048d9eae4603b3aff5ff2d` |
| ZIP `12_...V2.md` | `91a4d894341e2cdcf62d4651247747bec1525b3ec468081d30d5fae4b5b8db63` |
| ZIP `13_...V1.md` | `5543ab0a7c937ab3e448678376df9c0240cbebb8bfd4c581eb6994cbe6b104de` |
| ZIP `SHA256SUMS_ADENDO_V2.txt` | `0246c5fe92c891acbeb2682f7a9f05d438ab9cf5b24cc3105d7876c7015c569f` |

`SHA256SUMS_REV02_FINAL.txt` acrescenta o ZIP e os três relatórios desta validação às 22 entradas, sem listar segredos e sem incluir a si próprio (para evitar hash circular). Ele não substitui o manifesto REV02 da pasta externa.

## 3. Confronto e decisões

A [`MATRIZ_CONFLITOS_REV02_FINAL.md`](MATRIZ_CONFLITOS_REV02_FINAL.md) confronta a V2 documento a documento com 00, 01, 02, 03, M52, M53, M54, M55, 08, 09, 10, 11, README/hierarquia, V1 e o ZIP novo. Cada linha identifica seção, texto conflitante ou limite, regra vigente, correção e status. As propostas D01–D14 com fórmula, parâmetro, versão, teste e condição de revisão estão em [`DECISOES_CONTRATOS_FASE_1_V1.md`](DECISOES_CONTRATOS_FASE_1_V1.md).

Os pontos **já reconciliados como interpretação técnica**, sujeitos a aceite do texto final, são: `INSUFFICIENT_EVIDENCE` como motivo em vez de quarto estado; evento sem Q não recebe Score competitivo por M53 §53.5; `answerId` temporal preserva M52 §52.18; λ temporal permanece ln(2)/180; Score mundo maduro em 97; Radar maduro em 90 + R_A/R_B + IC; ranking só de habilidade mundial; dados sociais protegidos; estilo sem ranking; snapshots/versionamento mantidos. Isso não ratifica o limite 30 nem os pesos de clusters.

**Conflitos ainda bloqueantes:**

1. M55 §55.2 fixa `INITIAL` para 0–43; V2 externa usa `EVALUATION` desde 30. O piso DA 44 não elimina a contradição do estado. É necessária emenda formal ou retirada do limite 30.
2. ZIP `12_...V2.md` usa `<44 INITIAL`, exige `γ_ij` como nome do componente e diz que não deve ser renomeado; V2 externa usa `<30 INITIAL` e `r_ij`. O ZIP também introduz `INITIAL` no Score mundo até 43, contra M55 §55.1, que põe 1–96 em `EVALUATION`.
3. O ZIP `13_...V1.md` afirma aprovação para implementação; V2 externa §9 e hierarquia REV02 dizem aprovação pendente. Sem decisão explícita do responsável, nenhum desses status altera 00.
4. 08 §8 ainda descreve ground truth no snapshot imutável; o contrato de referência temporal a AnswerVersion exige diff da especificação de dados antes do schema social.
5. A Fase 1 do Blueprint inclui entidades de dados pessoais e matemáticos. Não se pode alegar conclusão da fase inteira com política de dados, catálogo, autorização e pesos ainda não aprovados.

## 4. Verificação numérica documental

Um cálculo independente em Python padrão confirmou `exp(−ln(2)×d/180)` em 0/90/180/360 dias = `1 / 0,707107 / 0,5 / 0,25`. A regra **candidata** de peso médio entre clusters dá `n_eff=2` para dois clusters de tamanhos 2 e 1, todos contemporâneos. Em uma fixture com cluster A de ganhos `+1,−1` em idades `0,180` dias e cluster B de ganho `+0,4` em idade 0: pesos internos de A `2/3,1/3`, `W_A=0,75`, `W_B=1`, média agregada `0,371429` e `n_eff=1,96`. Isso verifica aritmética, **não** valida independência estatística nem aprova `W_c=mean(t)`.

Outra fixture com `τ_r²=0,04`, `n_eff=90` e resíduo observado `0,30` dá fator condicional de contração `0,776786` e estimativa `0,233036`. O intervalo Wald condicional ilustrativo é `[0,047833;0,418238]`; **não é o IC95% oficial** do modelo cruzado, pois ignora incerteza dos hiperparâmetros. D03 propõe bootstrap completo, cuja cobertura ainda precisa de simulação. Não houve teste estatístico empírico com dados reais nem teste de aplicação nesta validação documental.

## 5. Critérios de aceite e situação

| Critério solicitado | Evidência | Resultado |
| --- | --- | --- |
| Releitura integral | 12 DOCX, REV02, diff, matriz, hierarquia, README, manifests, rastreabilidade, Gate 0 e ZIP adicional inventariados | **Atendido** |
| 22/22 hashes | comparação SHA-256 contra os bytes externos; 13/13 REV01 também | **Atendido** |
| Nenhuma regra adendo contra M55/Motor | V2 30–43 diverge de M55 §55.2; ZIP diverge também no Score mundo | **Não atendido** |
| Contratos necessários à Fase 1 definidos | D01–D14 têm propostas testáveis; ramo de autoridade, dados pessoais e conteúdo Radar sem aceite | **Não atendido para implementação** |
| Cada decisão com teste | D01–D14 e fixtures numéricas | **Atendido como proposta** |
| Nenhuma pendência bloqueante sem decisão | Há alternativas executáveis documentadas, mas não decisão formal do produto/jurídica nem catálogo de 12 itens | **Não atendido** |

**Decisões solicitadas ao responsável do produto antes de reavaliar o gate:** (i) escolher V2 externa ou V2 interna do ZIP como base e declarar a outra histórica; (ii) ratificar emenda pontual `INITIAL/EVALUATION` do Radar 30 ou manter M55 44; (iii) ratificar a leitura de Score “primeira resolução elegível”; (iv) aprovar ou devolver D02–D14, em especial peso intercluster, matriz de dados/consentimento e autorização; (v) fornecer/aprovar as 12 perguntas e plano de expansão; (vi) submeter política de dados à revisão jurídica antes de uso real. Após essas decisões, atualizar a hierarquia e os documentos atingidos com diff, novo manifesto e novos testes. **Não iniciar a Fase 1 até autorização expressa posterior.**

## 6. Limites desta entrega

Nenhum DOCX oficial, README REV01/REV02 publicado, V2 externa publicada ou arquivo do ZIP foi modificado. Os três relatórios e o manifesto final são arquivos novos no workspace. `git diff --check` e verificação de integridade dos artefatos documentais são os checks aplicáveis; lint, typecheck, build, migrações e testes da aplicação não se aplicam a esta etapa exclusivamente documental. A revisão jurídica não foi realizada por este relatório.

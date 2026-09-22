# ORVOK — hierarquia documental REV02 (proposta)

**Data:** 22/09/2026. **Estado:** pendente de validação do responsável do produto. A Fase 1 permanece bloqueada. Esta revisão indexa a reconciliação; não modifica os 12 DOCX REV01.

1. Decisões oficiais e congelamentos expressos: Documento 00, Definição Oficial 01, Visual System 02 e Operational Freeze 03, cada qual em seu domínio.
2. Emendas de governança M54 e decisões oficiais posteriores **expressamente validadas**, limitadas às cláusulas que declarem alterar o freeze.
3. Fechamentos consolidados M55 e, depois de validado, o fechamento V2 apenas nas alterações pontuais listadas na matriz A01–A11. A V2 não recebe autoridade global sobre 00–03.
4. Especificações matemáticas e funcionais M52/M53 e demais cláusulas vigentes de 01–03, sem misturar parâmetros candidatos com congelados.
5. Documentação técnica 08–11, subordinada a requisitos funcionais e matemáticos.
6. Decisões técnicas/ADRs posteriores que não contradigam as camadas superiores.
7. V1 do fechamento de lacunas, rascunhos e antecedentes M32–M51: históricos ou propostas, salvo cláusula explicitamente ratificada.

Uma data ou número de versão não prova substituição. A V2 **corrige a V1 homônima**, mas só passa a reger os tópicos A01–A11 após validação formal. O README REV01 e `SHA256SUMS.txt` permanecem fotografia íntegra do pacote original; `README_ORVOK_CODEX_REV02.md` e `SHA256SUMS_REV02.txt` indexam a proposta adicional, sem substituir silenciosamente a precedência do Documento 00.

**Conflitos expressos:** a fronteira `INITIAL/EVALUATION` 30 proposta na V2 altera a de 10 da V1 e deve ser ratificada; o piso de DA 44 e maturidade 90 + R_A/R_B + IC95% do 03 continuam; `INSUFFICIENT_EVIDENCE` é motivo, não estado; a relação `r_ij` substitui o uso ambíguo de símbolos na V1 sem ainda definir estimador; pesos intercluster e retenção são candidatos. Consulte a matriz para efeito e teste de cada decisão.

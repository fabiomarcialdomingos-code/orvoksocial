# ORVOK Social V1 — diagnóstico pré-implementação (Gate 0)

> **Releitura documental posterior:** a pasta de referências recebeu o arquivo `ORVOK_FECHAMENTO_LACUNAS_MATEMATICA_LGPD_CONTRATOS_V1.md` após a aprovação do Gate 0 e conclusão da Fase 0. A análise inicial está em [`docs/RELEITURA_REFERENCIAS_ADENDO_V1.md`](docs/RELEITURA_REFERENCIAS_ADENDO_V1.md). A reconciliação proposta encontra-se em [`ORVOK_FECHAMENTO_LACUNAS_MATEMATICA_LGPD_CONTRATOS_V2.md`](ORVOK_FECHAMENTO_LACUNAS_MATEMATICA_LGPD_CONTRATOS_V2.md), com [`matriz A01–A11`](MATRIZ_ADENDO_A01_A11_V2.md) e [`hierarquia REV02`](ORVOK_HIERARQUIA_DOCUMENTAL_REV02.md). Este diagnóstico preserva a fotografia original de 43 grupos; V2 pendente de validação, Fase 1 bloqueada.

> **Decisão formal posterior:** a [`V2 canônica`](ORVOK_FECHAMENTO_LACUNAS_MATEMATICA_LGPD_CONTRATOS_V2_CANONICA.md) substitui as propostas acima. A V2 externa anterior e o ZIP divergente são obsoletos; o restante deste diagnóstico preserva o estado histórico do Gate 0. Preparação estrutural limitada da Fase 1 foi autorizada, sem cálculos ou telas. Os limiares oficiais e a notação `γ_ij` estão no [README canônico](README_ORVOK_CODEX_REV02_CANONICO.md).

**Data:** 22/09/2026
**Escopo:** preparação documental e inspeção técnica; nenhum código de aplicação iniciado.
**Status do Gate 0:** aprovado pelo responsável do produto. A Fase 0 foi autorizada separadamente; D1, D2 e L1–L6 permanecem pendentes para as fases afetadas.

## Registro anterior ao início da Fase 0 — 22/09/2026

**Autorização:** diagnóstico Gate 0 aprovado pelo responsável do produto; Fase 0 autorizada exclusivamente para fundação técnica e ambiente reprodutível. Fase 1 depende de nova autorização. Nenhum dos 190 arquivos removidos será restaurado e nenhum código legado será usado como base.

**Contagem de requisitos:** os **43** IDs R01–R43 são grupos de requisitos rastreáveis deste diagnóstico, não 43 histórias, casos de teste ou regras atômicas. Não há no diretório atual inventário anterior de requisitos com contagem verificável para comparar. O número **190** citado na autorização descreve arquivos removidos, outra unidade de contagem, e não deve ser confundido com requisitos. Se surgir matriz anterior, a comparação deverá mapear IDs e granularidade antes de afirmar aumento ou redução de escopo.

**Arquivos/diretórios previstos para a Fase 0:** `.git/`, `.github/workflows/ci.yml`, `.gitignore`, `.editorconfig`, `.gitattributes`, `.nvmrc`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, configuração do formatter, `vitest.config.ts`, `playwright.config.ts`, `postcss.config.mjs`, `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`, `src/app/` (layout, página e estilos de fumaça), `src/lib/` (configuração de ambiente e cliente Prisma), `tests/` (smoke da aplicação/infraestrutura), `docs/` (execução local, decisões e rastreabilidade), `.env.example` e arquivos exemplo por ambiente. Pastas de domínios futuros podem ser documentadas sem criar implementação funcional. A lista poderá ser ajustada apenas por necessidade técnica da fundação, com justificativa no relatório de encerramento.

**Pendências preservadas:** D1 (Score sem quórum), D2 (gabarito em snapshot), L1 (estimador γ/IC/shrinkage), L2 (pesos de clusters), L3 (retenção/exclusão), L4 (progressão do Radar), L5 (matriz fina de autorização) e L6 (contratos finos de fluxos/API/telas). Nenhuma será resolvida por código na Fase 0.

**Critério objetivo de aceite:** Git inicializado e commit identificável; versões fixadas e lockfile reproduzível; instalação limpa; `lint`, `typecheck`, testes básicos e `build` aprovados; smoke HTTP e conexão PostgreSQL/migração inicial verificados em ambiente de desenvolvimento; CI equivalente configurada; nenhum segredo real ou código legado versionado; documentação local e ADRs técnicos presentes. Se a conexão/migração não puder ser executada, a fase será relatada como **bloqueada**, sem declarar conclusão.

## Resumo executivo

O pacote REV01 está íntegro e contém 12 documentos DOCX oficiais. Os três documentos obrigatórios (M52, M53, M54) foram lidos integralmente, assim como os demais DOCX, o README e as duas referências visuais. A camada de reconciliação 00 declara o pacote **apto para handoff**, com precedência explícita. Radar Humano é a porta de entrada e principal mecanismo de aquisição/conexão; essa decisão está encerrada em 01 §3 e M55 §55.8.2, apesar da nota histórica de M54 §54.5.

O diretório de trabalho está vazio e não contém `.git`, código, dependências, banco, testes nem configuração. Há, portanto, uma Fase 0 real de fundação, não migração de código legado. O pacote permite iniciá-la após aprovação. A implementação completa ainda exige contratos detalhados em pontos específicos: estimator de γ/intervalo de confiança, pesos de clusters, política de exclusão/retenção, fluxo de ampliação do questionário social e a relação entre Score inicial e eventos sem quórum. Nenhuma dessas lacunas autoriza simplificação silenciosa.

## A. Inventário e autoridade

Hierarquia **normativa vigente**, por 00 §4, repetida em 10 §4, 11 §2 e README: **00** reconcilia conflitos; **01** define comportamento; **02** identidade visual; **03** fórmulas e parâmetros operacionais; **04–07** fundamentação, governança e fechamento reconciliado; **08** persistência; **09** arquitetura; **10** execução; **11** handoff; código abaixo dos documentos. A posição de um documento não revoga regras de outro domínio. Substituição só ocorre onde 00/M55 ou conteúdo específico a declara. Partes históricas dentro de documentos vigentes são identificadas abaixo.

| Documento/arquivo na pasta de referências | Versão | Finalidade | Status / autoridade | Relacionados | Conflito ou limite | Impacto técnico |
|---|---|---|---|---|---|---|
| `00_ORVOK_Auditoria_Consolidacao_Documental_V1_FINAL_REV01.docx` | V1 FINAL REV01 | Reconciliação e precedência | Vigente, nível 1 | 01–11 | Resolve candidatos antigos, estado de evidência, Radar e visual | Regra de interpretação do pacote inteiro |
| `01_ORVOK_Definicao_Oficial_Produto_V1_REV01.docx` | V1 REV01 | Produto e escopo | Vigente, nível 2 | 00, 02–11 | Fluxo alvo responde antes da previsão diverge de exemplos E2E de 09/11; prevalece 01 | Jornadas, permissões, eventos, grupos, perfil |
| `02_ORVOK_Visual_System_V1_Engenharia.docx` | V1 | Sistema visual e landing | Vigente/congelado, nível 3 | 00, imagens, 01 | A narrativa visual Mundo→Pessoas→Você convive com Radar como entrada funcional; não implica alterar entrada | Tokens, logo SVG, componentes, responsividade |
| `03_ORVOK_Motor_Matematico_V1_Especificacao_Tecnica_Executavel_REV01.docx` | V1.0 REV01 | Operational Freeze matemático | Vigente/congelado, nível 4 | 00, 04–08 | Define modelo γ e shrinkage, mas não o estimador reproduzível completo; §22 cita resultado posterior no snapshot, reconciliado por 08 §2/§6 | Motor versionado, evidência, cálculos e testes |
| `04_M52_Instrumento_DNA_Social_V1_2_REV01.docx` | M52 V1.2 REV01 | Instrumento social, consentimento, DA/γ | Complementar vigente, nível 5; fórmulas candidatas superadas por 03 onde declarado | 00, 03, 06–08 | §52.6/§52.9 candidatos; 03/M55 congelam maturidade; CP harmônica permanece candidata | Radar, privacidade, baseline, item bank |
| `05_M53_Motor_Consenso_Scoring_V1_1_REV01.docx` | M53 V1.1 REV01 | Consenso, backfill, Gain, Opportunity Set | Complementar vigente, nível 5; parâmetros candidatos superados por 03 | 00, 03, 06–08 | Q/pooling/N antigo candidatos; §53.5 sem quórum versus Score imediato em 07 precisa regra explícita | Eventos, consenso, score, auditoria |
| `06_M54_Emendas_Governanca_Roteiro_V1_REV01.docx` | M54 V1 REV01 | Skill/style, incerteza, validação | Complementar vigente, nível 5 | 00, 01, 03–07 | §54.5 mantém dúvida antiga sobre entrada; 01/M55 §55.8.2 a encerram | Ranking seletivo, UX estatística, métricas de piloto |
| `07_M55_Fechamento_Consolidado_MVP_V1_REV01.docx` | M55 V1 REV01 | Fechamento matemático e reconciliação | Complementar vigente, nível 5; §55.1/§55.2/§55.8.6 contêm histórico explicitamente superado | 00, 01, 03–06 | Escadas 43/97/385 e 44/97 históricas; perfil de 30 traços fora da V1; ME conservadora | Estados, Score, escopo do perfil |
| `08_ORVOK_Modelo_de_Dados_Motor_Matematico_V1.docx` | V1.0 | Entidades, snapshots, cálculo e auditoria | Vigente técnico, nível 6, sujeito a 00–07 | 03, 09 | §4.4 enum de evento simplificado; §8 põe `targetGroundTruth` em snapshot imutável, embora chegue após a previsão | Schema e migrations exigem reconciliação explícita |
| `09_ORVOK_Arquitetura_Tecnica_Completa_V1.docx` | V1.0 | Stack, camadas, APIs conceituais, operação | Vigente técnico, nível 7 | 01, 03, 08, 10 | E2E social §26 inverte ordem de gabarito de 01; endpoints ainda conceituais | Limites de módulo, auth, jobs, infraestrutura |
| `10_ORVOK_Blueprint_de_Implementacao_V1_Codex_REV01.docx` | V1.0 REV01 | Fases e gates | Vigente execução, nível 8 | 00–09, 11 | Ordem de módulos não afasta dependências de consenso/score; inspeções ampliadas por este pedido | Sequência e aceite por fase |
| `11_ORVOK_Pacote_Mestre_de_Execucao_CODEX_V1_REV01.docx` | V1.0 REV01 | Handoff e disciplina | Vigente execução, nível 9 | 00–10 | E2E social §21 inverte ordem oficial; seguir 01 | Relatórios, bloqueios, qualidade |
| `README_ORVOK_CODEX_REV01.md` | REV01, 22/09/2026 | Manifesto e ordem de leitura | Complementar de controle; remete a 00 | 00–11, SHA256SUMS | Declara referências M32–M51 históricas e não obrigatórias | Integridade e Gate 0 |
| `ORVOK_FECHAMENTO_LACUNAS_MATEMATICA_LGPD_CONTRATOS_V1.md` | V1, sem REV/data normativa declarada | Proposta de fechamento matemático, LGPD e contratos após Gate 0 | **Adendo posterior não incorporado ao pacote REV01**; autoridade abaixo de 00–11 até revisão formal | 00, 03–09, Gate 0; análise detalhada no adendo | Radar n_eff≥30 e novo estado versus freeze; modelo γ, clusters e política de dados requerem reconciliação | Afeta fases 1–13; nenhuma mudança na Fase 0 |
| `ORVOK_FECHAMENTO_LACUNAS_MATEMATICA_LGPD_CONTRATOS_V2.md` | V2, 22/09/2026 | Revisão corretiva da proposta V1 | **Proposta pendente de validação**, limitada a A01–A11; não substitui globalmente 00–03 | V1, 00–11, matriz e hierarquia REV02 | Corrige fronteiras, notação, clusters e status LGPD; estimador e contratos ainda faltam | Pode orientar próximas decisões; não abre Fase 1 |
| `ORVOK_HIERARQUIA_DOCUMENTAL_REV02.md` | REV02, 22/09/2026 | Precedência da reconciliação | Proposta de controle, pendente de validação | 00, README REV01, V1/V2 | Declara alterações pontuais e preserva freeze não alterado | Evita incorporação automática da V1 |
| `MATRIZ_ADENDO_A01_A11_V2.md` | V2, 22/09/2026 | Decisão, impacto e aceite por adendo | Proposta de controle, pendente de validação | R01–R43, V1/V2 | A01/A03/A04/A07 ainda requerem decisão ou método | Gates de teste e bloqueios |
| `README_ORVOK_CODEX_REV02.md` e `SHA256SUMS_REV02.txt` | REV02, 22/09/2026 | Índice e integridade do pacote ampliado | Controles novos; não revogam REV01 | 00–11, V1/V2, matriz e diff | Manifesto não inclui `Chaves.txt` | Proveniência verificável |
| `DIFF_FECHAMENTO_V1_V2.patch` | V1→V2 | Diff textual integral | Evidência comparativa, sem autoridade normativa | V1, V2 | Não é fonte autônoma de regra | Revisão humana do escopo alterado |
| `SHA256SUMS.txt` | sem versão | Manifesto de integridade | Controle, sem autoridade de produto | 00–11, README | 13/13 hashes conferem | Proveniência do pacote |
| `ChatGPT Image 22 de set. de 2026, 12_17_57.png` | sem versão | Referência visual de marca | Complementar visual; 02 prevalece | 02 | Imagem não é especificação executável | QA visual do logo/paleta |
| `ChatGPT Image 22 de set. de 2026, 12_18_39.png` | sem versão | Referência visual da landing | Complementar visual; 02 prevalece | 02 | Não usar como fundo raster | QA da landing |
| `Chaves.txt` | sem versão | Material de credenciais/segredos (nome e metadados apenas) | Sensível, **não** fonte de requisito; conteúdo não reproduzido | Futura configuração de ambiente | Não listado no manifesto SHA-256 | Secret manager; nunca Git ou relatório público |

**Documentos referidos mas não presentes:** M32, M33–M39, M43, M51, Doc 1, Doc 3 e a antiga Diretriz Visual/Inventário de Telas. Segundo 00 §§2,7 e README, são antecedentes históricos, formato de teste ou escopo fora da V1, **não dependências externas de execução**. Não foram procurados fora do pacote nem tiveram conteúdo presumido. Um arquivo autônomo chamado “Master de Perfis” também não existe; M52–M55 trazem esse cabeçalho, e os 30 traços antigos estão fora do lote V1. Não há contratos OpenAPI, DDL/migrations, matriz completa de permissões, inventário detalhado das telas internas, ADRs autônomos, guia operacional de backup/restore ou suíte de aceite prontos; 08–11 fornecem apenas parte dessas definições.

## B. Mapa funcional por domínio

| Domínio | Requisitos encontrados / origem principal | Superfície provável |
|---|---|---|
| Autenticação e contas | Entrada em 12 perguntas antes do login; conta para persistir/convidar; cadastro/login/sessão/recuperação; hash; e-mail + telefone em M53 §53.12; RBAC administrativo (01 §§3,12; 05 §53.12; 09 §§7–8) | Identity, sessão, conta, perfis |
| Radar Humano | Convite→aceite→consentimento→gabarito→previsão→resolução; item bank/versionamento; vetor de probabilidade; DA preliminar, γ maduro; leitura cruzada opcional (01 §§3,5; 03 §§5–12; 04) | Radar, SocialPrediction, Question |
| Previsões sobre o mundo | Evento com critério/fonte prévios, janela no backend, snapshot imutável, versão vigente, resolução/NULL, sem vazamento; eventos V1 binários (01 §§4,11; 05 §§53.4–53.6; 07 §55.8) | WorldEvent, Prediction, Resolution |
| Grupos | Criar/participar; proposta de evento de grupo; publicação/rejeição por administrador responsável; ground truth auditável (01 §§2,11; 07 §55.8.3) | Group, Membership, Moderation |
| Perfil e reputação | Score mundial, histórico, relações consentidas, Meu Espelho/Três Espelhos, imagens próprias/iniciais, sem 30 traços (01 §§7–8; 07 §§55.8.1–55.8.2) | Profile, Mirror, Ranking |
| Feed e interações | Home pessoal + descoberta; seguir, cinco reações e comentários; Dilema da Semana voluntário; sem pontos por reação (01 §6; 09 §20) | Home, Social |
| Notificações | Jobs e endpoints conceituais; eventos sociais relevantes (09 §§15,18) | Notification; regras finas pendentes |
| Moderação | Publicação de eventos de grupo, conteúdo/usuários, cancelamento/NULL, proteção contra informação de desfecho (01 §§11–12; 05 §53.12; 09 §22) | Moderation, EventReview |
| Painel administrativo | SUPER_ADMIN, ADMIN, MODERATOR, ANALYST, SUPPORT; usuários, eventos, Entrelinhas, moderação, segurança, analytics, auditoria; ações críticas autorizadas/confirmadas/auditadas (01 §12; 09 §§8,22) | Command Center, RBAC |
| Scoring e consenso | Brier binário, BSS auxiliar, Gain diferença Brier, Score 0–100; clipping 0,05–0,95, pooling log-odds, Q=5, LOO, semeadura/backfill; Opportunity Set (03 §§13–15; 05 §§53.3–53.9; 07 §55.0) | MathEngine, Consensus, Score |
| Evidência e incerteza | INITIAL/EVALUATION/SUFFICIENT; Score maduro n_eff≥97; Radar n_eff≥90 + R_A/R_B≥10 + IC95%(γ) exclui zero; margem e N; baseline 1.500; clusters; insight com magnitude absoluta de D≥0,20 e replicação (00 §8; 03 §§3–19; 07) | Evidence, Baseline, Insights |
| Consentimento e privacidade | Public/Shared/Private; consentimentos distintos; revogação; exportação/exclusão desde o dia 1; respostas de terceiros protegidas; sem inferência clínica (01 §§3,9–10; 04 §52.21; 09 §12) | Consent, DataRights, Policy |
| Auditoria | snapshots, versões de pergunta/baseline/motor, CalculationRun/Input/MetricResult, EventResult, AuditLog, reprocessamento histórico (03 §§22–25; 08 §§5–25) | Audit, Provenance, Jobs |
| Identidade visual | Playfair/Inter; tokens cromáticos; logo SVG geométrico; grid 12/8/4; landing editorial; foco, contraste, reduced motion; QA em seis larguras (02 inteiro) | Design System, Landing |
| Infraestrutura e operação | Next.js 16, React 19, TypeScript, Tailwind, Prisma 7, PostgreSQL, Auth.js, Vitest/E2E, CI, staging/produção, observabilidade, backup/restore (09 §§3,23–32; 10 §§6,29) | Platform, CI/CD, Operations |

## C. Matriz de rastreabilidade inicial

**Legenda:** P0 essencial/segurança/invariante; P1 fluxo necessário para V1; P2 validação/pós-piloto. `D` definido, `C` candidato, `P` pendente, `X` conflitante. Classes: PROD produto, MATH matemática, SEC segurança, PRIV privacidade, DATA dados, UX interface, OPS operação. “Teste futuro” indica evidência exigida, não teste já executado. A matriz será desdobrada em casos individuais e IDs estáveis a cada fase.

| ID | Origem | Requisito | Classe/Pri. | Módulo provável; dados | Teste futuro | Estado |
|---|---|---|---|---|---|---|
| R01 | 01 §2; 00 §5 | Quatro pilares V1, sem economia/ligas/30 traços | PROD/P0 | Navegação; catálogo | E2E escopo | D |
| R02 | 01 §3; 07 §55.8.2 | Radar é porta de entrada; 12 perguntas pré-login | PROD/P0 | Onboarding; sessão provisória | E2E convidado→conta | D |
| R03 | 01 §3; 07 §55.8.5 | Convite→aceite→consentimento do alvo→gabarito→previsão→resolução | PRIV/P0 | Radar; Invitation, Consent, AnswerVersion | E2E ordem e negação | D |
| R04 | 01 §3; 04 §52.21 | Consentir responder ≠ consentir ser previsto | PRIV/P0 | Consent; finalidade/versão | Integração autorização | D |
| R05 | 04 §52.2; §52.18 | Vetor soma 1; gabarito e previsão imutáveis/versionados | DATA/P0 | SocialSnapshot, AnswerVersion | Invariantes/constraint | D |
| R06 | 04 §§52.17,52.20 | Sem ver gabarito anterior; item bank/família; Opportunity Set social | SEC/P0 | Radar; exposure/opportunity | Teste leakage/replay | D |
| R07 | 03 §§6–8; 04 §§52.7–52.9 | DA Corr(p−q,y−q), baseline exclui alvo, n_eff por dependência | MATH/P0 | Math/Social; baseline/cluster | Vetor conhecido + invariantes | D |
| R08 | 03 §§5,10–11; 07 §55.2 | γ maduro: n_eff≥90, R_A/R_B≥10, IC95% exclui 0; RadarScore=50+50γ | MATH/P0 | Relationship; MetricResult/CI | Sintéticos e limites | D quanto aos gates; P estimador |
| R09 | 03 §9 | b₂ interno; b₃ N_eff≥500, colinearidade e estabilidade | MATH/P0 | Projection; CalculationRun | Regressão sintética/privacidade | D quanto ao requisito; P método preciso |
| R10 | 03 §§7–8; 04 §52.23 | N_calib=1500; extremo q<.10 ou >.90 exige sensibilidade | MATH/P0 | BaselineVersion | Exclusão alvo/extremos | D |
| R11 | 03 §§3–4; 05 §53.9 | Half-life 180d; n_eff=(Σw)²/Σw²; dependência agrupada | MATH/P0 | Weighting/Cluster; weights | 180/360d e cluster | D fórmula; P peso de cluster |
| R12 | 01 §4; 07 §55.8.4 | Uma previsão mundial vigente por usuário/evento; correção cria snapshot | DATA/P0 | Prediction; supersession | Concorrência/histórico | D |
| R13 | 01 §11; 07 §55.8.3 | Lifecycle DRAFT→PENDING_MODERATION→PUBLISHED→SEEDING→ACTIVE→FROZEN→RESOLVED/NULL | PROD/P0 | Event; transition log | Máquina de estados | D |
| R14 | 01 §4; 05 §§53.4,53.12 | Critério/fonte e prazo prévios; fechar no backend; sem resultado conhecido | SEC/P0 | Event/Resolution | API limites e leakage | D |
| R15 | 05 §53.4; 07 §55.8 | Mundo V1 binário; distribuição/confiança válida | PROD/P0 | Prediction; probabilityVector | API validação | D |
| R16 | 05 §§53.3–53.6; 03 §13 | Q=5 contas distintas; clip 5–95%; log-odds; leave-one-out | MATH/P0 | ConsensusSnapshot | Q=4/5, extremos, LOO | D |
| R17 | 05 §53.5 | Semeadura com referência pendente e backfill no quórum, versionado | MATH/P0 | Consensus/Score; reference link | E2E semeadura→quórum | D |
| R18 | 05 §53.7; 07 §55.0 | Gain=Brier_cons−Brier_self; Score=50+50×G_global | MATH/P0 | Score; CalculationRun | Exemplos conhecidos | D |
| R19 | 03 §15; 07 §55.1 | Score mundial EVALUATION antes de n_eff 97, SUFFICIENT a partir de 97 | MATH/P0 | Score/Evidence | Limites 0/1/96/97 | D |
| R20 | 05 §§53.5,53.13; 07 §§55.0–55.1 | Score desde primeira previsão resolvida versus evento sem quórum sem Score público | PROD/P0 | Score/public API | E2E evento sem Q | X: decisão D1 |
| R21 | 05 §53.8; 07 §55.0 | Opportunity Set e Coverage são controle, não recompensa | MATH/P0 | Opportunity/Analytics | Seleção de eventos | D |
| R22 | 03 §§16–17; 06 §54.2; 07 §55.3 | Métrica pública: valor±margem, N e estado; margem Score 98/√n_eff conservadora | MATH/P0 | Evidence/public DTO | API/UI 1/97, limites | D; constante futura C |
| R23 | 01 §8; 03 §§20–21; 06 §54.1 | Ranking Global/Categoria/Círculo só habilidade mundial, com evidência | PROD/P0 | Ranking; RankSnapshot | Propriedade: social/style excluídos | D |
| R24 | 01 §§7,9; 03 §§18–19 | Três Espelhos compatíveis; insight com IC, magnitude absoluta de D≥.20, replicação; sem diagnóstico | PROD/P1 | Mirror/Insight; templateVersion | E2E ausência/evidência | D; dimensões P |
| R25 | 01 §§5–6 | Leitura Cruzada opcional; Home pessoal/descoberta, seguir, reações, comentários, Dilema | PROD/P1 | Social/Feed | E2E e Score invariável | D; detalhes P |
| R26 | 01 §§2,11; 07 §55.8.3 | Grupos e eventos propostos, moderação por admin do grupo | PROD/P1 | Group/EventReview | E2E papéis/resolução | D; regras finas P |
| R27 | 01 §§7–8 | Perfil Meu Espelho, foto escolhida ou iniciais, sem avatar automático | UX/P1 | Profile/Media | E2E sem foto | D |
| R28 | 01 §10; 04 §52.21 | Public/Shared/Private; respostas e ground truth privados | PRIV/P0 | Policy; visibility | Matriz de acesso horizontal | D; matriz detalhada P |
| R29 | 01 §10; 04 §52.21 | Revogar, exportar e excluir desde dia 1; retirar agregado público | PRIV/P0 | DataRights; Consent/Audit | E2E revogação/exportação/exclusão | D quanto ao direito; P retenção |
| R30 | 03 §§22–25; 08 §§5–25 | Snapshots/resultado/baseline/runs históricos reprocessáveis e auditáveis | DATA/P0 | Provenance; versões/hashes | Reprocessar motor antigo e novo | D |
| R31 | 08 §8; 01 §3; 04 §52.18 | Ground truth tardio em SocialPredictionSnapshot imutável | DATA/P0 | SocialSnapshot/AnswerVersion | Ordem temporal/imutabilidade | X: decisão D2 |
| R32 | 01 §12; 09 §§8,22–23 | Command Center RBAC, confirmação e AuditLog de ações críticas | SEC/P0 | Admin/RBAC/Audit | Autorização por ação | D; matriz fina P |
| R33 | 09 §§7,17,23 | Auth.js/Credentials+bcrypt; validação, CSRF/XSS, rate limit, logs seguros | SEC/P0 | Identity/API | Pentest automatizado básico | D; detalhe sessão P |
| R34 | 05 §53.12 | E-mail + telefone na verificação leve de identidade | SEC/P1 | Registration; identities | E2E cadastro/duplicação | D; fluxo de verificação P |
| R35 | 09 §§15–16,24–28 | Jobs idempotentes, observabilidade, migrations, ambientes e seeds controlados | OPS/P0 | Jobs/DB/CI | Replay, migration, alertas | D |
| R36 | 02 §§2–20 | Tokens, logo SVG, landing editorial, mobile, foco e reduced motion | UX/P1 | Design System/Landing | Visual 6 larguras + a11y | D |
| R37 | 03 §27; 04 §52.20; 05 §53.10 | Fórmulas internas e anti-Goodhart fora da UX/API pública | SEC/P0 | API/UI/Docs | Contrato não expõe mecanismo | D |
| R38 | 06 §§54.3–54.4; 01 §13 | Métrica-Norte Pares de Previsão Mútua Ativos; janela de piloto | OPS/P2 | Analytics | Contagem determinística | C janela |
| R39 | 07 §55.4; §55.8.1 | 30 traços, EmpathyScore/IntuitionScore/DecisionEfficiency fora da V1 | PROD/P0 | Guardrail de escopo | Auditoria de features | D |
| R40 | 01 §3; 04 §52.9 | 12 perguntas iniciais versus ≥44 itens independentes e ≥90 para maturidade | PROD/P1 | Radar/ItemBank | E2E progressão de evidência | P: decisão D4 |
| R41 | 09 §§18–20 | APIs por domínio com schemas versionados; paginação/autorização | DATA/P0 | API/contracts | Contract test | D princípio; P schemas |
| R42 | 09 §15 | Notificações após eventos sociais relevantes | PROD/P1 | Notification/Outbox | Integração entrega/dedup | P regras específicas |
| R43 | 10 §29 | Produção: P0, testes, migrations, backup/restore, observabilidade, staging, rollback | OPS/P0 | Release/Operations | Ensaio restauração/rollback | D |

## D. Diagnóstico do repositório e ambiente

| Item | Constatação |
|---|---|
| Estrutura atual | Diretório `C:\Arquivos\Micro Saas\Filiais\orvok social` vazio, inclusive arquivos ocultos; `rg --files` = 0. O único arquivo local criado nesta etapa é este relatório. |
| Git | `git status`, branch e log retornaram “not a git repository”; não há histórico a preservar nem branch existente. |
| Tecnologias instaladas | Windows/PowerShell; Node `v24.18.0`, npm `12.0.2`, Git `2.55.0.windows.3`, Python `3.14.6`. `pnpm`, `docker`, `psql` e `pandoc` não encontrados no PATH. |
| Configuração/dependências | Nenhum `package.json`, lockfile, `.env.example`, config TS/ESLint/Tailwind/Prisma, CI ou variáveis definidas pelo projeto. Stack prescrita em 09 §3, ainda não instalada. |
| Banco | Nenhum schema, migration, seed ou instância/cliente PostgreSQL detectável por estes comandos. Ausência de `psql` no PATH não prova que servidor remoto/local inexista. |
| Testes | Nenhuma suíte, runner ou artefato de teste. Nenhum teste de aplicação executável nesta etapa. |
| Material sensível | `Chaves.txt` tem 362 bytes/11 linhas; não foi aberto nem copiado para o projeto. Deve ser tratado como segredo fora do Git. |
| Referências | 12 DOCX extraídos para diretório temporário do sistema, dois PNG inspecionados visualmente; nenhum original alterado. Manifesto SHA-256: 13/13 correspondências. |
| Riscos técnicos | Sem PostgreSQL e sem ferramenta de contêiner no PATH; estimador γ/CI e clusters não totalmente especificados; contratos finos de auth/privacidade/UI/admin ausentes; possível conflito entre exclusão e histórico imutável; segredo fora de manifesto. |

## E. Registro de decisões e pendências

### Contradições documentais ou estruturais

| ID | Evidência | Efeito e tratamento proposto | Decisão exigida |
|---|---|---|---|
| D1 — Score sem quórum | M55 §55.0 diz Score desde a primeira previsão resolvida; M55 §55.1 permite EVALUATION em n_eff 1–96; M53 §53.5 diz que evento sem Q não gera Score público. 03 §15 fixa maturidade, mas não arbitra este caso. | Afeta elegibilidade de eventos, Score público, ranking e E2E. Não usar o evento sem consenso como Gain válido por suposição. | Definir se “primeira” significa primeira previsão **pontuável com consenso**, e o que aparece no painel pessoal quando o evento resolve sem Q. |
| D2 — gabarito tardio em snapshot | 08 §8 lista `targetGroundTruth` no `SocialPredictionSnapshot` imutável; 01 §3 e M52 §52.18 exigem gabarito prévio à previsão, mas resolução/versão posterior ainda pode ocorrer; 08 §2 manda resultados separados. | Inserir depois violaria imutabilidade ou exporia o gabarito no momento da previsão. | Aprovar vínculo imutável a `AnswerVersion` protegido e resolução em registro separado, ou publicar revisão formal do modelo. |
| D3 — ordem do fluxo social em testes | 01 §3 e M55 §55.8.5: gabarito antes da previsão; 09 §26 e 11 §21 exemplificam previsão antes da resposta. | **Resolvido pela hierarquia 00**: testes serão corrigidos para a ordem de 01. | Sem nova decisão de produto; validar correção de critérios de aceite na Fase 7. |
| D4 — status antigos | M54 §54.2 cita NÃO DETERMINADO/DETERMINADO; M55 §§55.1–55.2 registra escadas antigas; 08 §4.4 usa OPEN/CLOSED/CANCELLED. | **Resolvido por 00, 01, 03 e M55 REV01**: estados INITIAL/EVALUATION/SUFFICIENT, lifecycle de 01. | Nenhuma decisão; registrar em testes para evitar regressão. |
| D5 — Radar como entrada | M54 §54.5 deixa dúvida aberta; 01 §3 e M55 §55.8.2 a encerram explicitamente. | **Resolvido**: Radar é entrada e aquisição, sem excluir outros pilares. | Nenhuma decisão; só reabrir por revisão formal. |

### Lacunas bloqueantes para a fase afetada

| ID | Lacuna, origem e fase afetada | Decisão/artefato necessário |
|---|---|---|
| L1 | 03 §10 e M52 §52.13 exigem modelo cruzado α/β/γ com shrinkage, mas não dão estimador, distribuição, regularização, estratégia para dados esparsos nem IC95% reproduzível. Bloqueia Fase 8 e RadarScore maduro. | Especificação matemática versionada com pseudocódigo, parâmetros e dados sintéticos de referência; manter DA preliminar enquanto isso. |
| L2 | 03 §4, M52 §52.8 e M53 §53.9 exigem desconto por famílias/clusters, mas não fixam regra de formação/ponderação nem como aplica n_eff ponderado. Bloqueia Score/Radar oficial nas Fases 5/8. | Contrato de clusters, pesos e exemplos conhecidos aprovado. |
| L3 | M52 §52.21 exige exclusão/exportação; 03 §§22–23 e 08 §25 exigem reprodutibilidade histórica. Falta política operacional de retenção, anonimização, supressão de agregados e tratamento de backups. Bloqueia schema de dados pessoais e Fase 2/7. | Política de dados aprovada, incluindo base/finalidade, prazos e efeitos da revogação; revisão jurídica/LGPD apropriada. |
| L4 | 01 §3 define 12 perguntas iniciais; 03 §5 exige 44/90 observações efetivas e suporte relacional. Falta jornada de novas rodadas/itens, exposição, frequência e validação da independência. Bloqueia conclusão do Radar maduro na Fase 8; não bloqueia onboarding em Fase 2. | Especificar progressão de itens/convites e critérios de UX para estado preliminar. |
| L5 | 01 §12 e 09 §8 listam papéis, mas não a matriz de permissões por ação; 01 §10 não fixa todas as regras de compartilhamento por papel/relação. Bloqueia ações do Command Center e publicação/visibilidade fina. | Matriz recurso×ação×papel×escopo e política de díades aprovadas. |
| L6 | 01 §§5–6,11 e 09 §§18–20 descrevem notificações, Dilema, Leitura Cruzada, Home, grupos/moderação e telas internas em nível conceitual; faltam campos, transições e contratos de payload/erros. Bloqueia aceite completo das Fases 3, 9–13, conforme a função. | Contratos funcionais e de API/tela por fluxo; decisões de produto apenas onde mudarem comportamento. |

### Lacunas não bloqueantes agora

E2E framework e package manager podem ser escolhidos tecnicamente na Fase 0, registrados e testados; a stack prescrita não muda. A especificação de recuperação de acesso, estratégia de sessões, rate limit, observabilidade, filas e provedor de mídia ainda precisa de contrato técnico antes de suas respectivas fases. Localização/idiomas e política de conteúdo precisam ser verificados com produto antes da UI final. A ausência de M32–M51 não bloqueia a V1 por decisão expressa de 00 §7. A ausência de `docker`/`psql` no PATH bloqueia apenas a execução local de testes de banco até que haja infraestrutura equivalente.

### Parâmetros candidatos dependentes de piloto

Janela de recorrência da Métrica-Norte (00 §14; 01 §13); recalibração **futura** de Q, pooling, meia-vida, limiares de evidência e variância empírica (M53 §53.13, M55 §55.3), sempre com nova engineVersion/revisão; método/combinação de Compatibilidade Preditiva CP (M52 §52.14), que não deve ser publicado sem validação; cortes Low/Mid/High e cruzamentos com 30 perfis (M55 §55.6). O piloto não autoriza mudar os valores V1 durante a implementação. Em especial, Q=5, pooling log-odds e 180 dias são **operacionais congelados** agora, embora candidatos a futura recalibração.

### Decisões já congeladas que não devem ser reabertas neste Gate

Quatro pilares e Radar como entrada; 12 perguntas iniciais pré-login; sem modo anônimo relacional; estados INITIAL/EVALUATION/SUFFICIENT; Score mundial maduro em n_eff≥97; Radar maduro com n_eff≥90, R_A/R_B≥10 e IC95%(γ) sem zero; r_min=.30 apenas referência Fisher; Q=5, clip .05–.95, pooling log-odds, half-life 180 dias, baseline 1.500; snapshots imutáveis e recálculo versionado; ranking apenas de competência mundial; exclusão de economia/ligas/30 traços/diagnóstico; Visual System V1 congelado.

## F. Plano de execução até produção

**Regra de gate comum a cada fase:** declarar fontes/IDs da matriz e arquivos alterados; implementar só escopo aprovado; executar unitários, integração, E2E e autorização pertinentes; lint, TypeScript, build e migration quando aplicáveis; inspeções independentes com evidência e severidade em **arquitetura, banco/migrações, fórmulas, segurança/autorização, privacidade/LGPD, APIs, frontend/acessibilidade, responsividade/desempenho, testes, observabilidade/auditoria, aderência documental e produção**. Um eixo sem superfície na fase recebe “não aplicável” justificado. Críticos/altos corrigidos antes do gate ou impedimento aprovado. Atualizar matriz, registrar relatório e só avançar após autorização quando houver conflito, decisão de produto ou mudança estrutural relevante. O aceite abaixo se soma a esse gate, não o substitui.

| Fase | Objetivo e entregáveis | Dependências | Critério de aceite / testes | Inspeção de maior risco; condição de avanço |
|---|---|---|---|---|
| 0 — Fundação | Git, Next.js/React/TS/Tailwind/ESLint, Prisma/Postgres, Vitest/E2E, env/CI/scripts | Aprovação Gate 0; 09/10/11 | install reproduzível, dev/build/lint/test, conexão e migration mínima; smoke CI | Supply chain, secrets, ambiente; avançar com base reproduzível |
| 1 — Dados | Entidades, constraints, índices, migrations e seed controlado | 08; decisões L2/L3 para schemas afetados | migration limpa/reversa em ambiente de teste, FK, imutabilidade, concorrência e leitura | Integridade, privacidade, reprocessamento; avançar sem órfãos/violação histórica |
| 2 — Identidade e privacidade | Cadastro/login/sessão, perfil mínimo, consentimentos, exportação/exclusão | 01/04/09; L3 e fluxo de verificação | E2E conta/sessão; testes horizontais, revogação, exportação/exclusão | Auth, LGPD, segredos; avançar com direitos exercíveis |
| 3 — Perguntas/eventos/grupos | Versionamento de itens, lifecycle, fonte/critério, propostas/moderação | 01/07/08/09; L6 da função | Máquina de estados, publicação autorizada, fechamento server-side, fonte imutável | Moderação, transições e API; avançar com evento auditável |
| 4 — Previsão mundial | Card/UX, confiança, Opportunity Set, snapshot e versão vigente | Fases 2–3; 01/05/08 | E2E previsão, concorrência, rejeição após fechamento, histórico e leakage | Snapshot, privacidade e UI; avançar com dados completos |
| 5 — Resolução/Brier/Score | Resultados, Brier/Gain, evidência, Score/categoria, cálculo versionado | Fase 4; L2, D1; 03/05/07 | Casos conhecidos, n_eff 96/97, margem, nulidade, replay | Fórmulas/cluster/CI; avançar com score reproduzível |
| 6 — Consenso | Q, clipping, log-odds, LOO, semeadura/backfill, consenso de fechamento | Fases 4–5; 03/05 | Q4/Q5, 5 contas, backfill sem UPDATE de previsão, idempotência | Temporalidade e leakage; avançar com referência auditável |
| 7 — Radar fluxo | Convites, consentimento separado, respostas versionadas, previsão social, revogação | Fases 1–2; 01/04/07; D2/L3 | E2E ordem oficial, negativa/revogação, acesso horizontal, exportação | Privacidade/imutabilidade; avançar sem gabarito público |
| 8 — Motor social | Baseline/DA/projeção/b₃/αβγ/shrinkage/RadarScore/evidência | Fase 7; L1/L2/L4; 03/04/07 | Vetores sintéticos, IC, n_eff, R_A/B, sensibilidade e reprocessamento | Estatística e anti-Goodhart; avançar só com estimador especificado e testado |
| 9 — Espelhos/insights | Comparações compatíveis, texto versionado e Dilema conforme contrato | Fases 5/8; 01/03; L6 | Ausência de insight imaturo, magnitude de D/IC/replicação, linguagem não diagnóstica | Matemática/copy/privacidade; avançar com evidência |
| 10 — Social/home/notificações | Seguir, reações, comentários, Home, notificações | Fases 2–4; 01/09; L6 | E2E social; dedup; nenhuma reação muda Score | Abuso, acessibilidade, desempenho; avançar com permissões |
| 11 — Perfil | Meu Espelho, Score, histórico, foto/iniciais e controles de privacidade | Fases 5,7–10 | E2E 3 escopos e sem foto; N/margem/estado em toda métrica | Vazamento/UX estatística; avançar com contratos públicos íntegros |
| 12 — Rankings | Global/Categoria/Círculo, snapshots e evidência | Fases 5,10–11; D1 | Reprodução de posição; propriedade exclui estilo/social; autorização de círculo | Ranking justo e privacidade; avançar sem métrica imatura seca |
| 13 — Command Center | RBAC granular, moderação, usuários, eventos, analytics, segurança, AuditLog | Fases 2–12; L5/L6 | Matriz papel×ação, confirmação, trilha, negação, replay | Escalada de privilégio e auditoria; avançar sem bypass |
| 14 — Segurança/operação | Hardening, jobs, logs, monitoramento, backup/restore, runbooks | Todas as funções | Testes adversariais, carga crítica, restauração e alertas | Segurança e disponibilidade; avançar com SLO/rotinas verificadas |
| 15 — Verificação integrada | Regressão matemática, API, E2E, acessibilidade, performance, revisão documental | 0–14 | P0 verde; sem alto/crítico; build/migrations/CI verdes | Todos os 12 eixos; avançar com relatório de cobertura e riscos |
| 16 — Staging | Deploy isolado, migração ensaiada, dados sintéticos e telemetria | 15; infraestrutura aprovada | E2E real de ambiente, backup/restore, rollback ensaiado | Configuração, rede e dados; avançar com staging estável |
| 17 — Homologação | Aceite de produto/visual/matemática/privacidade e operação | 16; decisões pendentes encerradas | Critérios V1 assinados, testes de acesso e jornada aprovados | Inspeção independente final; avançar por autorização expressa |
| 18 — Produção | Release, migração, monitoramento e plano de rollback | 17; aprovação de publicação | Smoke pós-release, auditabilidade, backup e alertas | Go/no-go e observação; concluir somente com evidência operacional |

**Fase 0 recomendada após aprovação:** inicializar Git e stack prescrita; escolher package manager e framework E2E como decisões técnicas registradas; fixar versões/lockfile; criar ambientes e CI sem segredos; conectar PostgreSQL de desenvolvimento; entregar smoke de instalação, build, lint, runner e migration. Nenhuma lacuna matemática deve ser preenchida nessa fase.

## Evidências de verificação desta etapa

- `rg --files` no workspace retornou 0 antes da criação deste relatório; `Get-ChildItem -Force` não listou arquivos; `git status --short`, `git branch --show-current` e `git log -1` retornaram `fatal: not a git repository`.
- `Get-ChildItem -Recurse -File` na pasta fornecida listou 12 DOCX, 2 PNG, README, SHA256SUMS e Chaves.txt; não houve escrita nessa pasta.
- Extração **somente para leitura** dos `word/document.xml`, cabeçalhos/rodapés/notas dos 12 DOCX via biblioteca padrão Python, em `%TEMP%\orvok_gate0_20260922`; os documentos foram lidos integralmente, inclusive tabelas textuais. Dois PNG foram inspecionados visualmente. Os dois arquivos de imagem embutidos em 02 têm SHA-256 idêntico aos dois PNG externos; não há outras imagens embutidas nos DOCX.
- `Get-FileHash -Algorithm SHA256` comparado com `SHA256SUMS.txt`: 13/13 correspondências (12 DOCX + README).
- `node --version` = `v24.18.0`; `npm --version` = `12.0.2`; `git --version` = `2.55.0.windows.3`; `python --version` = `3.14.6`; `pnpm`, `docker`, `psql`, `pandoc` indisponíveis no PATH.
- Não houve instalação, migração, teste de aplicação, edição de original ou código de aplicação nesta etapa.

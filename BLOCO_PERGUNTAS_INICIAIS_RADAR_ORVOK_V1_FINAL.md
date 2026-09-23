# Adição das 12 Perguntas Iniciais do Radar Humano

**Catálogo:** `RADAR_BASE_CANDIDATA_V1`  
**Versão:** `1.0.0`  
**Status:** `PROPOSTA_PARA_APROVACAO`  
**Idioma:** `pt-BR` · **tipo:** escolha única · **sensibilidade:** `LOW` · **quantidade:** 12 perguntas, 4 opções cada.

As perguntas foram adicionadas exclusivamente como fixture de desenvolvimento/homologação. Nenhuma foi marcada como `APPROVED`, nenhuma pergunta oficial foi publicada e usuários reais continuam bloqueados.

## Catálogo

| ID | Categoria | Pergunta |
|---|---|---|
| Q01 | DECISAO | Quando precisa tomar uma decisão importante, qual caminho você tende a seguir? |
| Q02 | ADAPTABILIDADE | Quando um plano importante muda de última hora, como você costuma reagir? |
| Q03 | ROTINA | Se tivesse uma tarde completamente livre, o que provavelmente escolheria fazer? |
| Q04 | RELACIONAMENTOS | Quando surge um conflito com alguém importante, qual costuma ser sua primeira atitude? |
| Q05 | ABERTURA | Como você costuma reagir diante de uma experiência completamente nova? |
| Q06 | ORGANIZACAO | Como você normalmente organiza compromissos e tarefas? |
| Q07 | MOTIVACAO | Quando realiza algo importante, o que mais valoriza? |
| Q08 | COMUNICACAO | Em uma conversa difícil, como você tende a se comunicar? |
| Q09 | RISCO | Quando aparece uma oportunidade com possibilidade real de perda, o que você tende a fazer? |
| Q10 | PRIORIDADES | Se tivesse de escolher apenas uma prioridade para um período difícil, qual seria? |
| Q11 | APRENDIZADO | Quando percebe que não sabe fazer algo, qual costuma ser sua reação? |
| Q12 | SOCIAL | Em um encontro com várias pessoas, onde você provavelmente se sentiria mais confortável? |

Cada pergunta contém exatamente as opções A, B, C e D na ordem fornecida no fixture. O texto completo e as opções estão em [`fixtures/radar-base-candidata-v1.json`](fixtures/radar-base-candidata-v1.json).

### Opções registradas

- **Q01:** A Analiso bastante antes de decidir; B Peço opinião a pessoas de confiança; C Confio principalmente na minha intuição; D Decido rapidamente e ajusto depois, se necessário.
- **Q02:** A Fico incomodado, mas tento reorganizar tudo; B Procuro entender o motivo e sigo em frente; C Vejo a mudança como uma oportunidade; D Prefiro abandonar o plano e fazer outra coisa.
- **Q03:** A Encontrar ou conversar com alguém; B Descansar e ficar mais quieto; C Fazer algo produtivo ou aprender algo; D Sair sem um plano definido.
- **Q04:** A Converso diretamente sobre o problema; B Espero a situação esfriar antes de falar; C Tento entender o lado da outra pessoa; D Prefiro evitar o assunto.
- **Q05:** A Fico animado e quero experimentar logo; B Observo primeiro antes de participar; C Pesquiso e me preparo; D Só participo se alguém conhecido estiver junto.
- **Q06:** A Planejo tudo com antecedência; B Organizo apenas o que considero mais importante; C Uso ferramentas, listas ou lembretes; D Resolvo conforme as coisas aparecem.
- **Q07:** A Saber que fiz um bom trabalho; B Receber reconhecimento das pessoas; C Perceber que ajudei alguém; D Alcançar um resultado melhor que o esperado.
- **Q08:** A Sou direto e falo exatamente o que penso; B Escolho as palavras para não ferir a outra pessoa; C Faço perguntas antes de dar minha opinião; D Prefiro escrever em vez de conversar pessoalmente.
- **Q09:** A Evito se não tiver segurança suficiente; B Avalio os riscos e decido com cautela; C Aceito se a recompensa parecer importante; D Consulto alguém antes de decidir.
- **Q10:** A Cuidar da minha saúde e bem-estar; B Proteger as pessoas importantes para mim; C Resolver a situação financeira ou profissional; D Manter minha liberdade e autonomia.
- **Q11:** A Tento aprender sozinho; B Procuro alguém que possa ensinar; C Faço uma tentativa prática e aprendo com os erros; D Deixo para depois até surgir uma necessidade maior.
- **Q12:** A Conversando com poucas pessoas conhecidas; B Conhecendo pessoas novas; C Observando a conversa antes de participar; D Circulando entre grupos diferentes.

## Versionamento e proteção

Foi adicionada a categoria `PROPOSTA_PARA_APROVACAO` ao enum do catálogo, separando-a de `TEST_ONLY`, `CANDIDATE` e `APPROVED`. A versão registra `instrumentVersion`, `language`, `responseType`, `sensitivity`, `effectiveAt`, `createdAt` e `contentHash`. O importador exige quatro opções para propostas, IDs únicos, posições consecutivas e hash estável.

Versões existentes são imutáveis. Reimportação idempotente aceita somente o mesmo hash/opções; qualquer alteração em uma versão usada falha com conflito. Alterações futuras devem usar novo número de versão. Snapshots já referenciam `questionVersionId` e a opção composta dessa versão.

O catálogo candidato só é elegível em banco local de desenvolvimento/teste com o gate explícito `RadarCatalogControl.allowTestOnly`; produção e usuários reais não conseguem ler ou usar a proposta.

## Integração

O catálogo aparece no fluxo Radar de auto-resposta, convite, previsão e reciprocidade quando o consentimento e o gate local permitem. O Command Center exibe `PROPOSTA_PARA_APROVACAO`, versão, idioma, quantidade e opções. Nenhum selo de pergunta oficial é exibido.

## Fixtures e testes

- Fixture versionada: `fixtures/radar-base-candidata-v1.json`.
- Importação controlada e idempotente executada com sucesso: 12 versões imutáveis.
- Seed local habilitou apenas o gate de teste; não promoveu o catálogo.
- Teste estrutural: exatamente 12 IDs Q01–Q12, categorias únicas e quatro opções por pergunta.
- Prisma/schema: **PASS**.
- Migração limpa: **PASS**, 32 migrações.
- Migração incremental: **PASS**, 32 migrações.
- Unit/integration: **53 testes aprovados**.
- E2E: **22/22 aprovados**.
- Lint: **PASS**.
- Typecheck: **PASS**.
- Build: **PASS**, 33 rotas.
- RLS, autorização, consentimento, revogação, reciprocidade e snapshots: regressão aprovada pela suíte existente.

## Auditorias

Auditorias de banco/RLS, API, segurança, autorização, rastreabilidade e E2E não encontraram achados críticos ou altos. Nenhuma fórmula, threshold, RadarScore, γ, shrinkage, IC95% ou estado de evidência foi alterado.

## Arquivos e migrações

- `fixtures/radar-base-candidata-v1.json`
- `scripts/import-radar-catalog.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260924010000_radar_proposal_enum/migration.sql`
- `prisma/migrations/20260924020000_radar_proposal_metadata/migration.sql`
- `src/app/api/v1/[[...path]]/route.ts`
- `src/components/RadarWorkspace.tsx`
- `src/components/CatalogStatusPanel.tsx`
- `src/app/admin/page.tsx`
- `tests/unit/radar-catalog-proposal.test.ts`
- este relatório

O backlog visual foi preservado; nenhum redesign foi executado. O catálogo permanece candidato e não autoriza usuários reais, operação comercial, revisão jurídica ou infraestrutura hospedada.

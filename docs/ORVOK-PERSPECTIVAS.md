# ORVOK — Perspectivas

Nova experiência na branch `codex/orvok-perspectivas`: como as pessoas veem você é o centro da rede; acontecimentos do mundo criam novas conversas entre essas pessoas. A implementação foi reconstruída após a indisponibilidade da pasta de trabalho anterior e salva em etapas no GitHub. Os testes documentados aqui foram executados novamente sobre esta reconstrução.

## Experiência entregue

| Área          | Comportamento                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início        | Convite em destaque, conversas da comunidade e acesso às descobertas e ao Mundo.                                                                                          |
| Sobre mim     | Interesses privados, rodadas personalizadas, uma pergunta por vez, salvamento por resposta, opção de pular e capítulos.                                                   |
| Conexões      | Convite individual, escolha privada de pai, mãe, irmão, amigo, crush, parceiro, colega ou outra pessoa. Estados reais e atualização a cada 30 segundos com a aba visível. |
| Descobertas   | Expectativa de cada convidado comparada à resposta preservada. Sem ranking entre conjuntos diferentes de perguntas.                                                       |
| Mundo         | Eventos existentes, filtros por assunto, fontes, critérios, previsão com confiança, resolução e comentários.                                                              |
| Prever juntos | B tenta antecipar a escolha de A e registra sua própria previsão antes da revelação.                                                                                      |
| Perfil        | Nome ou apelido, biografia e imagem opcional. Idade e profissão opcionais, com controles separados de publicação. Interesses não são públicos.                            |

Nova composição visual: fundo claro, Inter, violeta, verde suave, blocos editoriais, navegação horizontal no desktop e inferior no celular. O CSS global e a composição das jornadas principais foram substituídos. A landing identifica seus exemplos como ilustrativos. As telas autenticadas consultam APIs.

## Seleção das perguntas

`src/lib/perspectives/catalog.json` contém **100 perguntas originais**, com quatro alternativas, em dez assuntos. Cada pergunta tem ID e versão. `model.ts` produz a seleção de forma determinística a partir do identificador persistido da rodada:

- Rodadas de 12 começam com quatro perguntas comuns. As demais usam interesses declarados, relação e diversidade de assuntos, reservando espaço para exploração.
- Idade, profissão e respostas anteriores não são usadas para inferir personalidade.
- A rodada diária é opcional: até três perguntas ainda não selecionadas nem puladas anteriormente, uma rodada por dia em `America/Sao_Paulo`.
- Pular substitui uma pergunta e registra sua exclusão. O catálogo é finito; quando não houver perguntas disponíveis, a interface informa isso.
- A relação influencia a seleção inicial. Ao compartilhar, é possível escolher a classificação privada de cada destinatário, preservando o conjunto da rodada.

O convite congela perguntas, versões e respostas de A. B prevê **o conjunto de A**, independentemente de suas próprias perguntas de apresentação. A comparação usa esse snapshot. Perguntas já reveladas à mesma pessoa continuam visíveis como conversa, mas não entram na nova contagem, mesmo se a conexão anterior tiver sido encerrada. Descobertas também elimina duplicações por pessoa/pergunta/versão.

**O catálogo é candidato editorial, não um instrumento psicométrico validado.** Os resultados indicam escolhas antecipadas nesta experiência. Não medem amor, caráter, compatibilidade ou personalidade. Confiança é registrada, mas esta versão não produz uma nota psicológica ou de calibração pessoal. Rodadas com perguntas diferentes não sustentam um ranking de quem conhece melhor alguém.

## Pessoas e acontecimentos

Três resultados permanecem separados: antecipar a escolha de alguém; fazer a mesma previsão; acertar o acontecimento oficial. Uma pessoa pode entender a previsão do crush e discordar dela.

O convite aponta para uma `WorldPrediction` imutável de A. B precisa registrar sua previsão do evento antes de revelar a comparação. Após uma revelação em dupla, o banco impede novas previsões naquele evento por ambos, inclusive após revogação da conexão. A trava protege esse fluxo; não prova que os participantes nunca conversaram fora do produto. Eventos continuam fechando dez minutos antes do horário de fechamento registrado.

Resultados oficiais vêm da resolução existente, com fonte/critério. Resoluções de teste, canceladas ou invalidadas são identificadas. Não foi criada publicação automática de eventos nem notificação específica de resolução para as duplas.

## Dados, consentimento e compatibilidade

Migração aditiva `20260928000000_perspectives`: tabelas `PerspectivePreferences`, `PerspectiveRound`, `PerspectiveConnection` e `PerspectiveMessage`. Não apaga nem converte o Radar anterior. O padrão SQL operacional existente do projeto é mantido.

Preferências e rodadas usam RLS por titular. Conexões e mensagens não recebem acesso direto pelo papel da aplicação. `orvok_perspective_connections` valida a sessão e devolve somente uma projeção autorizada. Respostas ficam ocultas até a confirmação integral. O rótulo da relação é removido para o destinatário. Aceite é individual e explícito; texto e versão do aviso são registrados. Bloqueios, estado da conta, expiração e revogação controlam acesso e envio de mensagens. Criação e revogação geram auditoria.

A exportação inclui preferências, rodadas e conexões visíveis com cursor, sem ficar limitada às 100 conexões recentes da interface. A projeção de cada conversa mostra as 100 mensagens mais recentes. Exclusão de dados continua sendo uma solicitação administrativa, não apagamento automático.

As respostas de quem cria a rodada são salvas a cada escolha. As previsões do convidado são confirmadas juntas ao final; o rascunho ainda não é salvo no servidor. As novas notificações internas cobrem convite aceito, descoberta concluída e mensagem privada. WhatsApp é aberto somente por ação do usuário; não existe envio automático de mensagem externa.

As rotas `/radar`, `/onboarding`, `/resultado` e `/eventos` encaminham às novas áreas. Histórico, pedidos anteriores, previsão anterior, reciprocidade e referência anterior permanecem acessíveis em `/historico`, `/convites`, `/previsao`, `/reciprocidade` e `/historico/referencia`. Administração, grupos, feed e autenticação usam os serviços existentes. O retorno ao convite é preservado na alternância entre cadastro e login.

## Instalação e execução

Requisitos do repositório: Node 24.18.0, pnpm 10.34.5 e PostgreSQL local conforme README. Preservar `.env` e `.env.local`; nunca publicar credenciais.

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm db:migrate
corepack pnpm db:provision:reapply
corepack pnpm dev
```

`db:provision:reapply` reaplica permissões da instalação local existente; numa instalação nova seguir o provisionamento inicial do README. As migrações usam a conexão proprietária; a aplicação continua usando `APP_DATABASE_URL` e `AUTH_DATABASE_URL` separados.

Localmente usar `APP_ENV=development`. Fora de desenvolvimento/teste, a jornada respeita as travas existentes `OFFICIAL_RADAR_CATALOG_ENABLED` e `REAL_USER_HOMOLOGATION_ENABLED`. Esta branch não altera essas variáveis nem aprova o catálogo para uso real. Revisar perguntas e avisos e homologar em staging antes de habilitar a experiência publicada.

## Verificação realizada

| Verificação              | Resultado                                                                                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:perspectives` | 53 verificações passaram. Todas as migrações em banco limpo, catálogo, personalização, persistência, RLS, consentimento, isolamento, revogação, snapshots, exportação paginada e independência das previsões do Mundo. |
| `pnpm typecheck`         | Passou.                                                                                                                                                                                                                |
| `pnpm lint`              | Passou, sem avisos.                                                                                                                                                                                                    |
| `pnpm build`             | Passou, 45 páginas estáticas geradas e rotas dinâmicas compiladas.                                                                                                                                                     |
| Chromium                 | Jornada A → convite → B → previsão → revelação → Descobertas; registro de previsão no Mundo; desktop 1440 px e celular 390 px, sem transbordamento horizontal e com navegação inferior correta.                        |

O teste de banco usa PostgreSQL via PGlite com papéis e políticas reais. Não substitui homologação de concorrência/conexões no PostgreSQL de staging. No teste de navegador, a API de Perspectivas e o SQL são reais; autenticação, perfil, feed e HTTP de eventos usam fixtures. Não é um teste de entrega de e-mail, login real ou produção.

O cenário de navegador está em `scripts/tests/perspectives-browser.mjs` e pode ser acoplado à suíte por `ORVOK_BROWSER_HARNESS`, com Next rodando separadamente em `ORVOK_UI_ORIGIN` (padrão `http://127.0.0.1:3000`). Requer Playwright disponível: `ORVOK_PLAYWRIGHT_MODULE` pode indicar o módulo instalado em outro diretório. Opcionalmente, `ORVOK_CHROMIUM_MODULE` aponta para uma distribuição de Chromium compatível com o ambiente. `ORVOK_UI_OUTPUT` controla o diretório de capturas. Sem essas variáveis, `test:perspectives` executa somente os testes de banco/API.

As capturas em `docs/screenshots/perspectivas` mostram a interface implementada com pessoas fictícias. Os testes existentes de autenticação, social, Radar e administração devem ser novamente executados contra staging antes de substituir a versão publicada.

## Próxima homologação de produto

Revisar linguagem, alternativas, cobertura e conforto dos participantes; observar conclusão de convites, conversas iniciadas e retorno voluntário. Ampliar o catálogo conforme o uso. Um painel de edição/aprovação desse novo banco, aprendizagem por comportamento, rascunho persistente de previsões do convidado e paginação completa das conversas são evoluções posteriores. A seleção entregue é explícita e auditável.

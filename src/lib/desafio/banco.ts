/**
 * Banco de perguntas do desafio: 100 gerais (10 temas × 10) e mais 15 para cada
 * tipo de relação (família, amigos, crush), distribuídas nos mesmos temas.
 *
 * - `{voce}` vira "você" para quem responde sobre si e o primeiro nome para
 *   quem tenta prever. As opções são neutras (infinitivo ou substantivo) e
 *   servem para os dois casos, sem marcar gênero.
 * - nível: 1 leve, 2 pessoal, 3 profunda. Nenhuma pergunta toca em saúde,
 *   política, religião ou vida íntima.
 * - âncora: pergunta de abertura que revela um eixo do jeito da pessoa. O mapa
 *   diz que traço cada opção indica (null quando a opção não revela nada).
 *     social: E expansivo, R reservado · ritmo: P planejado, S espontâneo ·
 *     cabeca: L razão, C coração
 * - para: traço de quem mais se divide nessa pergunta (bom para evitar o óbvio).
 * - d: pergunta divertida, boa para fechar o desafio.
 * - contexto: pergunta feita para um tipo de relação (família, amigos ou crush).
 *   As de crush são leves e sem nenhum conteúdo sexual.
 */
export type Eixo = "social" | "ritmo" | "cabeca";
export type Traco = "E" | "R" | "P" | "S" | "L" | "C";
export type Contexto = "familia" | "amigos" | "crush";
export const CONTEXTOS: Record<Contexto, string> = { familia: "Família", amigos: "Amigos", crush: "Crush" };
export type Tema = "decisoes" | "tempo-livre" | "relacoes" | "dinheiro" | "social" | "imprevistos" | "rotina" | "emocoes" | "gostos" | "futuro";
export type PerguntaBanco = {
  chave: string; tema: Tema; nivel: 1 | 2 | 3; texto: string; opcoes: [string, string, string, string];
  ancora?: { eixo: Eixo; mapa: [Traco | null, Traco | null, Traco | null, Traco | null] }; para?: Traco; d?: true;
  /** Perguntas específicas de um tipo de relação. Sem contexto: servem para todos. */
  contexto?: Contexto;
};
type Extra = Pick<PerguntaBanco, "ancora" | "para" | "d" | "contexto">;
const q = (chave: string, tema: Tema, nivel: 1 | 2 | 3, texto: string, opcoes: [string, string, string, string], extra: Extra = {}): PerguntaBanco =>
  ({ chave, tema, nivel, texto, opcoes, ...extra });

export const TEMAS: Record<Tema, string> = {
  decisoes: "Decisões", "tempo-livre": "Tempo livre", relacoes: "Relações", dinheiro: "Dinheiro", social: "Vida social",
  imprevistos: "Imprevistos", rotina: "Rotina", emocoes: "Emoções", gostos: "Gostos", futuro: "Futuro",
};

export const BANCO: PerguntaBanco[] = [
  // Decisões
  q("dec-primeiro", "decisoes", 1, "Diante de uma decisão importante, o que {voce} faz primeiro?", ["Listar prós e contras", "Seguir a intuição", "Ouvir alguém de confiança", "Esperar a poeira baixar"], { ancora: { eixo: "cabeca", mapa: ["L", "C", "C", "L"] } }),
  q("dec-cardapio", "decisoes", 1, "No restaurante, diante de um cardápio enorme, {voce} costuma…", ["Pedir o de sempre", "Pedir a sugestão da casa", "Arriscar o prato mais diferente", "Demorar uma eternidade"], { d: true }),
  q("dec-compra", "decisoes", 1, "Antes de uma compra cara, {voce} costuma…", ["Pesquisar por semanas", "Comprar no impulso", "Pedir a opinião de alguém", "Desistir no último minuto"], { para: "P" }),
  q("dec-depois", "decisoes", 2, "Depois de tomar uma decisão difícil, o mais comum é {voce}…", ["Seguir em frente sem olhar para trás", "Repassar tudo mil vezes na cabeça", "Buscar alguém que confirme a escolha", "Mudar de ideia"], { para: "C" }),
  q("dec-conselho", "decisoes", 2, "Quando um amigo pede um conselho, {voce} costuma…", ["Dizer a verdade, mesmo que doa", "Escolher as palavras com cuidado", "Mais escutar do que falar", "Contar uma história parecida"], { para: "L" }),
  q("dec-regra", "decisoes", 3, "Diante de uma regra que parece injusta, {voce} tende a…", ["Seguir a regra mesmo assim", "Questionar quem fez a regra", "Dar um jeito de contornar", "Depender de quem está vendo"], { para: "P" }),
  q("dec-risco", "decisoes", 2, "Aparece uma oportunidade boa, mas arriscada. O que {voce} faz?", ["Aceitar na hora", "Calcular todos os riscos antes", "Pedir um tempo para pensar", "Deixar passar"], { para: "S" }),
  q("dec-grupo", "decisoes", 1, "O grupo não consegue decidir onde comer. O que {voce} faz?", ["Decidir por todo mundo", "Sugerir duas opções e votar", "Topar qualquer coisa", "Já ter uma lista pronta"], { para: "R", d: true }),
  q("dec-plano", "decisoes", 1, "Uma viagem daqui a um mês. Quando {voce} começa a organizar?", ["No mesmo dia", "Uma semana antes", "Na véspera", "Deixar alguém organizar"], { ancora: { eixo: "ritmo", mapa: ["P", "P", "S", "S"] } }),
  q("dec-erro", "decisoes", 3, "Ao perceber que errou numa discussão, {voce} costuma…", ["Admitir na hora", "Admitir depois, com calma", "Mudar de assunto", "Explicar por que tinha razão"], { para: "C" }),
  // Tempo livre
  q("tl-sabado", "tempo-livre", 1, "Um sábado livre, sem compromissos. Como ele termina para {voce}?", ["Em casa, no próprio ritmo", "Com amigos, fora de casa", "Resolvendo pendências", "Num lugar nunca visitado"], { para: "S" }),
  q("tl-ferias", "tempo-livre", 1, "Férias perfeitas para {voce} são…", ["Praia e descanso total", "Cidade cheia de coisas para ver", "Natureza e trilha", "Casa sem despertador"], { para: "E" }),
  q("tl-serie", "tempo-livre", 1, "Quando começa uma série nova, {voce} costuma…", ["Maratonar em um fim de semana", "Ver um episódio por dia", "Abandonar no terceiro episódio", "Assistir só com recomendação"], { para: "S", d: true }),
  q("tl-hobby", "tempo-livre", 1, "Um passatempo que combina com {voce}:", ["Cozinhar", "Esporte ou academia", "Música ou arte", "Jogos"], { para: "R" }),
  q("tl-domingo", "tempo-livre", 1, "O domingo à noite, para {voce}, costuma ser…", ["Organizando a semana", "Vendo filme ou série", "Com a família", "Tentando dormir cedo, sem sucesso"], { para: "P" }),
  q("tl-show", "tempo-livre", 2, "Show da banda favorita, mas longe e caro. O que {voce} faz?", ["Ir de qualquer jeito", "Ir só se tiver companhia", "Assistir pela internet", "Esperar a próxima turnê"], { para: "C" }),
  q("tl-relaxar", "tempo-livre", 1, "Na hora de relaxar, {voce} prefere…", ["Ler", "Ouvir música ou podcast", "Sair para caminhar", "Rolar o celular"], { para: "R" }),
  q("tl-festa", "tempo-livre", 1, "Numa festa, {voce} geralmente é quem…", ["Anima a pista", "Conversa num canto", "Cuida de todo mundo", "Vai embora cedo"], { ancora: { eixo: "social", mapa: ["E", "R", null, "R"] } }),
  q("tl-viagem", "tempo-livre", 1, "Numa viagem, o que mais importa para {voce}?", ["Roteiro bem planejado", "Liberdade para mudar de ideia", "Boa companhia", "Comida local"], { ancora: { eixo: "ritmo", mapa: ["P", "S", null, null] } }),
  q("tl-presente", "tempo-livre", 2, "Um presente que deixaria {voce} feliz de verdade:", ["Uma experiência", "Algo útil", "Algo feito à mão", "Um livro ou jogo"], { para: "C" }),
  // Relações
  q("rel-magoa", "relacoes", 2, "Alguém próximo magoou {voce} sem perceber. O que acontece?", ["Falar na hora", "Esperar esfriar e conversar", "Deixar passar", "Demonstrar pelo comportamento"], { para: "C" }),
  q("rel-carinho", "relacoes", 2, "Como {voce} demonstra carinho, principalmente?", ["Com palavras", "Com presentes", "Passando tempo junto", "Fazendo favores"], { para: "C" }),
  q("rel-crise", "relacoes", 2, "Um amigo está numa fase difícil. O que {voce} faz?", ["Aparecer sem avisar", "Mandar mensagem todo dia", "Esperar o amigo procurar", "Resolver algo prático"], { para: "R" }),
  q("rel-segredo", "relacoes", 2, "Quando alguém conta um segredo, {voce}…", ["Guarda para sempre", "Conta só para uma pessoa de confiança", "Esquece em uma semana", "Fica desconfortável"], { d: true }),
  q("rel-discussao", "relacoes", 3, "Numa discussão com alguém querido, {voce} costuma…", ["Querer resolver na hora", "Precisar de um tempo a sós", "Ceder para acabar logo", "Insistir até convencer"], { para: "E" }),
  q("rel-aniversario", "relacoes", 1, "No próprio aniversário, {voce} prefere…", ["Festa grande", "Jantar com poucas pessoas", "Algo diferente, como uma viagem", "Que ninguém lembre"], { ancora: { eixo: "social", mapa: ["E", "R", null, "R"] } }),
  q("rel-mensagem", "relacoes", 1, "Quanto tempo {voce} costuma levar para responder uma mensagem?", ["Na hora", "Algumas horas", "Só no fim do dia", "Às vezes, para sempre"], { para: "S", d: true }),
  q("rel-desculpa", "relacoes", 3, "Quando precisa pedir desculpas, {voce} costuma…", ["Pedir de frente, olho no olho", "Mandar uma mensagem", "Fazer um gesto em vez de falar", "Demorar, mas pedir"], { para: "R" }),
  q("rel-familia", "relacoes", 2, "Na família, {voce} é quem…", ["Organiza os encontros", "Faz todo mundo rir", "Resolve os problemas", "Aparece quando dá"], { para: "E" }),
  q("rel-confianca", "relacoes", 3, "O que faz {voce} confiar em alguém?", ["Tempo de convivência", "Sinceridade, mesmo quando incomoda", "Atitude nos momentos difíceis", "Primeira impressão"], { para: "L" }),
  // Dinheiro
  q("din-extra", "dinheiro", 1, "Entrou um dinheiro inesperado. Para onde ele vai, no caso de {voce}?", ["Reserva ou investimento", "Uma experiência marcante", "Algo desejado há tempos", "Dividir com quem se gosta"], { para: "P" }),
  q("din-promocao", "dinheiro", 1, "Uma promoção imperdível de algo fora dos planos. O que {voce} faz?", ["Comprar na hora", "Pensar até a promoção acabar", "Mandar para alguém opinar", "Ignorar"], { para: "P" }),
  q("din-conta", "dinheiro", 1, "Na conta do restaurante em grupo, {voce} prefere…", ["Dividir igualmente", "Cada um pagar o que consumiu", "Pagar tudo e acertar depois", "Deixar alguém organizar"], { para: "E" }),
  q("din-emprestimo", "dinheiro", 2, "Um amigo pede dinheiro emprestado. O que {voce} faz?", ["Emprestar sem pensar duas vezes", "Emprestar e combinar a data", "Emprestar só um valor pequeno", "Arranjar uma desculpa"], { para: "C" }),
  q("din-controle", "dinheiro", 1, "Como {voce} controla os gastos?", ["Planilha ou aplicativo", "De cabeça", "Olhando o saldo de vez em quando", "Controle? Que controle?"], { para: "P", d: true }),
  q("din-luxo", "dinheiro", 1, "Um pequeno luxo de que {voce} não abre mão:", ["Comida boa", "Roupa ou tênis", "Tecnologia", "Viagem"], { para: "S" }),
  q("din-premio", "dinheiro", 2, "Com um prêmio grande na loteria, a primeira coisa que {voce} faria seria…", ["Quitar dívidas e guardar", "Viajar pelo mundo", "Ajudar a família", "Largar o emprego"], { para: "P" }),
  q("din-barato", "dinheiro", 1, "Algo mais barato, mas de qualidade duvidosa. {voce} tende a…", ["Economizar e arriscar", "Pagar mais pelo que confia", "Pesquisar opiniões antes", "Depender do humor do dia"], { para: "L" }),
  q("din-devolver", "dinheiro", 2, "Emprestou algo e não devolveram. O que {voce} faz?", ["Cobrar sem cerimônia", "Dar indiretas", "Esquecer o assunto", "Nunca mais emprestar"], { d: true }),
  q("din-valor", "dinheiro", 3, "Para {voce}, dinheiro serve principalmente para…", ["Segurança", "Liberdade", "Experiências", "Cuidar de quem se ama"], { para: "C" }),
  // Vida social
  q("soc-grupo", "social", 1, "Num grupo novo de pessoas, {voce} costuma…", ["Puxar conversa", "Observar antes de falar", "Procurar alguém conhecido", "Ficar à vontade logo de cara"], { ancora: { eixo: "social", mapa: ["E", "R", "R", "E"] } }),
  q("soc-telefone", "social", 1, "O telefone toca com um número desconhecido. O que {voce} faz?", ["Atender na hora", "Deixar tocar e pesquisar o número", "Esperar mandarem mensagem", "Atender com voz desconfiada"], { para: "R", d: true }),
  q("soc-convite", "social", 1, "Chega um convite de última hora para sair. O que {voce} faz?", ["Topar na hora", "Topar se já estiver com roupa de sair", "Recusar e ficar em casa", "Perguntar quem vai antes"], { para: "S" }),
  q("soc-foto", "social", 1, "Nas fotos em grupo, {voce} é quem…", ["Organiza todo mundo", "Faz careta", "Sai de olho fechado", "Fica de fora tirando a foto"], { d: true }),
  q("soc-elogio", "social", 1, "Ao receber um elogio em público, {voce} costuma…", ["Agradecer e seguir", "Ficar sem graça", "Devolver com outro elogio", "Desconversar com humor"], { para: "R" }),
  q("soc-redes", "social", 1, "Nas redes sociais, {voce} costuma…", ["Postar com frequência", "Só observar", "Postar só momentos especiais", "Mandar tudo no privado"], { para: "E" }),
  q("soc-opiniao", "social", 2, "Numa roda de conversa, {voce} discorda de todo mundo. O que acontece?", ["Defender o próprio ponto", "Perguntar mais antes de opinar", "Guardar para si", "Mudar de assunto"], { para: "L" }),
  q("soc-silencio", "social", 1, "Um silêncio constrangedor numa conversa. O que {voce} faz?", ["Puxar qualquer assunto", "Fazer uma piada", "Esperar o outro falar", "Olhar o celular"], { para: "E" }),
  q("soc-papel", "social", 2, "Num trabalho em grupo, {voce} acaba sendo quem…", ["Lidera", "Tem as ideias", "Executa", "Mantém a paz"], { para: "P" }),
  q("soc-atraso", "social", 1, "Num encontro marcado com amigos, {voce} chega…", ["Antes da hora, sempre", "No horário", "Com um pouco de atraso", "Muito depois, com uma boa desculpa"], { ancora: { eixo: "ritmo", mapa: ["P", "P", "S", "S"] } }),
  // Imprevistos
  q("imp-plano", "imprevistos", 1, "O plano deu errado na última hora. O que {voce} faz?", ["Improvisar na hora", "Se irritar e depois resolver", "Pedir ajuda", "Aceitar e mudar de assunto"], { para: "P" }),
  q("imp-sinal", "imprevistos", 1, "Sem sinal de celular numa cidade desconhecida, {voce} tende a…", ["Perguntar para alguém na rua", "Tentar se achar sem ajuda", "Voltar para o último lugar conhecido", "Aproveitar para explorar"], { para: "S" }),
  q("imp-chuva", "imprevistos", 1, "Choveu no dia do passeio ao ar livre. O que {voce} faz?", ["Ir mesmo assim", "Trocar por outro programa", "Remarcar para outro dia", "Comemorar e ficar em casa"], { d: true }),
  q("imp-noticia", "imprevistos", 3, "Ao receber uma notícia ruim, {voce} prefere…", ["Ficar um tempo a sós", "Conversar com alguém na hora", "Se ocupar com outra coisa", "Pesquisar tudo sobre o assunto"], { para: "C" }),
  q("imp-voo", "imprevistos", 1, "O voo foi cancelado e o próximo é só amanhã. O que {voce} faz?", ["Reclamar no balcão", "Aceitar e procurar um hotel", "Buscar outro caminho, qualquer um", "Transformar em passeio pela cidade"], { para: "S" }),
  q("imp-aniversario", "imprevistos", 2, "{voce} esqueceu o aniversário de alguém importante. E agora?", ["Ligar e admitir o esquecimento", "Mandar mensagem como se tivesse lembrado", "Compensar com um presente", "Comemorar depois, em grande estilo"], { d: true }),
  q("imp-prazo", "imprevistos", 2, "Com prazo apertado e muita pressão, {voce} costuma…", ["Render mais do que nunca", "Travar no começo e depois deslanchar", "Pedir ajuda", "Fazer o possível e aceitar"], { para: "P" }),
  q("imp-fila", "imprevistos", 1, "Alguém fura a fila. O que {voce} faz?", ["Reclamar na hora", "Comentar alto com quem está perto", "Deixar para lá", "Encarar em silêncio"], { ancora: { eixo: "social", mapa: ["E", "E", "R", "R"] } }),
  q("imp-quebrou", "imprevistos", 2, "{voce} quebra algo na casa de um amigo. O que acontece?", ["Contar na hora", "Oferecer para pagar antes de tudo", "Esperar alguém perceber", "Fazer uma piada para aliviar"], { para: "C" }),
  q("imp-mudanca", "imprevistos", 3, "Uma mudança grande aparece do nada, como mudar de cidade. Como {voce} reage?", ["Com empolgação", "Com medo, mas topando", "Pedindo tempo para pensar", "Resistindo até o fim"], { para: "P" }),
  // Rotina
  q("rot-manha", "rotina", 1, "Como são as manhãs para {voce}?", ["Acordar cedo e bem", "Precisar de um tempo para engrenar", "Depende muito do dia", "Preferir mil vezes a noite"], { para: "S" }),
  q("rot-despertador", "rotina", 1, "Quando o despertador toca, {voce} costuma…", ["Levantar na hora", "Adiar uma vez", "Adiar várias vezes", "Acordar antes dele"], { ancora: { eixo: "ritmo", mapa: ["P", "S", "S", "P"] }, d: true }),
  q("rot-cafe", "rotina", 1, "No café da manhã, {voce} costuma…", ["Comer bem, sem pressa", "Tomar só um café", "Pular direto para o almoço", "Comer andando"], { para: "P" }),
  q("rot-mesa", "rotina", 1, "Como fica o lugar onde {voce} trabalha ou estuda?", ["Impecável", "Uma bagunça organizada", "Uma bagunça mesmo", "Depende da semana"], { ancora: { eixo: "ritmo", mapa: ["P", "S", "S", null] } }),
  q("rot-agenda", "rotina", 1, "Para lembrar dos compromissos, {voce} costuma…", ["Usar agenda ou aplicativo", "Anotar em papel", "Confiar na memória", "Contar com alguém para lembrar"], { para: "S" }),
  q("rot-exercicio", "rotina", 1, "Com exercício físico, {voce} costuma…", ["Ter rotina fixa", "Ir em fases", "Esperar o médico mandar", "Se mexer no dia a dia, sem academia"], { para: "P" }),
  q("rot-dormir", "rotina", 1, "Antes de dormir, {voce} costuma…", ["Ler", "Ver o celular até tarde", "Pensar em tudo o que precisa fazer", "Apagar assim que deita"], { d: true }),
  q("rot-cozinha", "rotina", 1, "Na cozinha, {voce} costuma…", ["Cozinhar com prazer", "Seguir a receita à risca", "Pedir delivery", "Improvisar com o que tem"], { para: "S" }),
  q("rot-mudar", "rotina", 2, "Quanto {voce} gosta de mudar a rotina?", ["Muito, rotina entedia", "Um pouco, de vez em quando", "Pouco, rotina traz paz", "Nada, mudança estressa"], { para: "E" }),
  q("rot-horario", "rotina", 1, "O melhor horário para {voce} produzir é…", ["Cedo", "À tarde", "À noite", "De madrugada"], { para: "L" }),
  // Emoções
  q("emo-filme", "emocoes", 1, "Num filme emocionante, {voce} costuma…", ["Chorar sem vergonha", "Segurar o choro", "Nem se abalar", "Chorar escondido"], { ancora: { eixo: "cabeca", mapa: ["C", "L", "L", "C"] } }),
  q("emo-irritacao", "emocoes", 2, "Quando algo incomoda {voce}, dá para perceber…", ["Na hora, pela cara", "Pelo silêncio", "Só bem depois", "Nunca: o disfarce é perfeito"], { para: "C" }),
  q("emo-vespera", "emocoes", 2, "Na véspera de algo importante, {voce} costuma…", ["Dormir tranquilamente", "Repassar tudo na cabeça", "Distrair a mente com outra coisa", "Conversar sobre isso com alguém"], { para: "L" }),
  q("emo-boa-noticia", "emocoes", 1, "Chega uma notícia muito boa. O que {voce} faz primeiro?", ["Contar para todo mundo", "Contar só para uma pessoa", "Guardar um pouco para si", "Comemorar a sós"], { para: "R" }),
  q("emo-saudade", "emocoes", 2, "Quando sente saudade de alguém, {voce} costuma…", ["Ligar na hora", "Olhar fotos antigas", "Guardar para si", "Marcar um encontro"], { para: "R" }),
  q("emo-terror", "emocoes", 1, "Filme de terror, para {voce}, é…", ["Diversão garantida", "Tortura", "Só com companhia", "Motivo para dormir de luz acesa"], { d: true }),
  q("emo-critica", "emocoes", 3, "Ao receber uma crítica, {voce} costuma…", ["Refletir e agradecer", "Se defender na hora", "Remoer por dias", "Depender de quem critica"], { para: "C" }),
  q("emo-dia-ruim", "emocoes", 2, "Quando o dia começa mal, {voce} costuma…", ["Virar o jogo rápido", "Passar o dia de mau humor", "Descontar em alguém sem querer", "Recomeçar depois de um café"], { para: "E" }),
  q("emo-desabafo", "emocoes", 3, "Quando precisa desabafar, {voce} procura…", ["Um amigo", "A família", "Escrever ou pensar a sós", "Ninguém: resolver a sós é melhor"], { para: "R" }),
  q("emo-dificil", "emocoes", 3, "Para {voce}, o mais difícil é…", ["Dizer não", "Pedir ajuda", "Admitir um erro", "Mostrar tristeza"], { para: "C" }),
  // Gostos
  q("gos-comida", "gostos", 1, "Uma comida que conquista {voce} fácil:", ["Pizza", "Comida japonesa", "Churrasco", "Doce"], { d: true }),
  q("gos-musica", "gostos", 1, "Numa viagem de carro, {voce} escolhe…", ["As mais tocadas do momento", "Clássicos que todo mundo canta", "Algo que ninguém conhece", "Podcast"], { para: "E" }),
  q("gos-clima", "gostos", 1, "O clima ideal para {voce} é…", ["Calor de praia", "Frio com cobertor", "Dia nublado", "Chuva lá fora"], { para: "R" }),
  q("gos-cinema", "gostos", 1, "Numa sessão de cinema, {voce} escolhe…", ["Comédia", "Ação", "Drama", "Terror"], { para: "L" }),
  q("gos-bebida", "gostos", 1, "Para começar o dia, {voce} precisa de…", ["Café", "Chá", "Suco ou água", "Nada, só coragem"], { d: true }),
  q("gos-roupa", "gostos", 1, "No dia a dia, {voce} se veste…", ["Básico e confortável", "Sempre com capricho", "Com cores e estampas", "Do jeito que der"], { para: "E" }),
  q("gos-bicho", "gostos", 1, "Um bicho de estimação para {voce}:", ["Cachorro", "Gato", "Algo exótico", "Nenhum, sem chance"], { d: true }),
  q("gos-paz", "gostos", 1, "Um lugar onde {voce} sente paz:", ["Praia", "Montanha", "Em casa", "Cidade movimentada"], { para: "R" }),
  q("gos-tabuleiro", "gostos", 1, "Num jogo de tabuleiro, {voce} costuma…", ["Jogar para vencer, sempre", "Jogar pela diversão", "Criar as próprias regras", "Desistir no meio"], { para: "L", d: true }),
  q("gos-surpresa", "gostos", 2, "Uma festa surpresa para {voce} seria…", ["O melhor presente", "Um pesadelo", "Legal, se fosse pequena", "Impossível: descobriria antes"], { para: "E" }),
  // Futuro
  q("fut-cinco", "futuro", 2, "Pensando nos próximos cinco anos, {voce} sente…", ["Animação com o que vem", "Tranquilidade, sem pressa", "Ansiedade e muitas dúvidas", "Foco num objetivo claro"], { para: "P" }),
  q("fut-morar", "futuro", 1, "Onde {voce} gostaria de morar um dia?", ["Na praia", "No interior", "Numa cidade grande", "Em outro país"], { para: "S" }),
  q("fut-aprender", "futuro", 1, "Para aprender algo novo, {voce} prefere…", ["Ler e estudar sem ajuda", "Ver alguém fazendo", "Fazer e errar", "Ter aulas com alguém"], { para: "L" }),
  q("fut-trabalho", "futuro", 2, "No trabalho, o que mais motiva {voce}?", ["Crescimento e reconhecimento", "Estabilidade", "Fazer diferença na vida das pessoas", "Liberdade de horário"], { para: "P" }),
  q("fut-lembranca", "futuro", 3, "Pelo que {voce} gostaria que as pessoas lembrassem?", ["Pela generosidade", "Pelo que construiu", "Pelas risadas", "Pela coragem"], { para: "C" }),
  q("fut-sonho", "futuro", 2, "Um sonho que {voce} ainda quer realizar:", ["Viajar para muito longe", "Ter o próprio negócio", "Formar uma família", "Aprender algo difícil"], { para: "C" }),
  q("fut-aposentadoria", "futuro", 2, "Na aposentadoria, {voce} se imagina…", ["Viajando", "Num sítio, cuidando da terra", "Trabalhando, porque parar entedia", "Com a casa cheia de gente"], { para: "S" }),
  q("fut-voltar", "futuro", 3, "Se pudesse voltar no tempo, {voce} iria…", ["Mudar muita coisa", "Mudar só um detalhe", "Não mudar nada", "Só reviver um dia especial"], { para: "C" }),
  q("fut-poder", "futuro", 1, "Um superpoder para {voce}:", ["Voar", "Ler pensamentos", "Parar o tempo", "Teletransporte"], { d: true }),
  q("fut-recomecar", "futuro", 3, "Largar tudo e recomeçar do zero em outro lugar. {voce} faria?", ["Sim, amanhã mesmo", "Sim, com um bom plano", "Só sem outra escolha", "Nunca"], { para: "S" }),
  // ——— Família ———
  q("fam-infancia", "emocoes", 1, "Quando era criança, {voce} era…", ["Uma criança agitada", "Uma criança tranquila", "Uma criança curiosa", "Uma criança teimosa"], { contexto: "familia" }),
  q("fam-reuniao", "social", 1, "Numa reunião de família, {voce} é quem…", ["Conta as histórias", "Ajuda na cozinha", "Fica com as crianças", "Some para o sofá"], { contexto: "familia", d: true }),
  q("fam-comida", "gostos", 1, "A comida de casa de que {voce} mais sente falta:", ["Arroz e feijão de todo dia", "Um doce de família", "O almoço de domingo", "Um lanche da infância"], { contexto: "familia" }),
  q("fam-conselho", "relacoes", 2, "Quando alguém da família dá um conselho que {voce} não pediu, a reação é…", ["Ouvir e agradecer", "Ouvir e fazer do próprio jeito", "Discutir na hora", "Mudar de assunto"], { contexto: "familia" }),
  q("fam-feliz", "tempo-livre", 1, "Na infância, o que deixava {voce} mais feliz?", ["Brincar na rua", "Ganhar um presente", "Viajar com a família", "Ficar em casa vendo desenho"], { contexto: "familia" }),
  q("fam-contato", "relacoes", 1, "Com que frequência {voce} fala com a família?", ["Todo dia", "Algumas vezes por semana", "Só quando tem novidade", "Quando alguém cobra"], { contexto: "familia", d: true }),
  q("fam-tarefa", "rotina", 1, "Em casa, a tarefa que {voce} mais detesta é…", ["Lavar louça", "Arrumar o quarto", "Tirar o lixo", "Passar roupa"], { contexto: "familia", d: true }),
  q("fam-briga", "relacoes", 3, "Numa discussão de família, {voce} costuma…", ["Tomar partido", "Tentar acalmar todo mundo", "Ficar de fora", "Resolver depois, em particular"], { contexto: "familia" }),
  q("fam-heranca", "emocoes", 3, "O que {voce} mais herdou da família?", ["O jeito de falar", "A teimosia", "O senso de humor", "O jeito de cuidar dos outros"], { contexto: "familia" }),
  q("fam-presente", "gostos", 2, "Um presente da família que emocionaria {voce}:", ["Fotos antigas", "Uma carta escrita à mão", "Uma viagem juntos", "Uma receita de família"], { contexto: "familia" }),
  q("fam-mudar", "futuro", 3, "Se pudesse mudar uma coisa na convivência da família, {voce} escolheria…", ["Mais almoços juntos", "Menos cobrança", "Mais viagens", "Mais conversas sinceras"], { contexto: "familia" }),
  q("fam-aperto", "dinheiro", 2, "Num aperto de dinheiro, {voce} pede ajuda para a família?", ["Sim, a família vem primeiro", "Só em último caso", "Nunca: prefere se virar", "Depende de quem"], { contexto: "familia" }),
  q("fam-conserto", "imprevistos", 1, "Quando algo quebra em casa, {voce} costuma…", ["Consertar com as próprias mãos", "Chamar um profissional", "Ver um tutorial e tentar", "Fingir que não viu"], { contexto: "familia", d: true }),
  q("fam-decisao", "decisoes", 3, "Qual decisão {voce} tomaria sem consultar a família?", ["Mudar de emprego", "Mudar de cidade", "Uma compra grande", "Nenhuma"], { contexto: "familia" }),
  q("fam-fim-de-ano", "social", 1, "No fim de ano, {voce} prefere…", ["Casa cheia e bagunça", "Algo pequeno e tranquilo", "Viajar", "Tanto faz, desde que tenha comida"], { contexto: "familia" }),
  // ——— Amigos ———
  q("ami-grupo", "social", 1, "No grupo de amigos, {voce} é quem…", ["Marca os encontros", "Some e reaparece", "Dá os melhores conselhos", "Faz todo mundo rir"], { contexto: "amigos" }),
  q("ami-viagem", "tempo-livre", 1, "Numa viagem com amigos, {voce} é quem…", ["Planeja tudo", "Topa tudo", "Cuida do dinheiro", "Esquece alguma coisa"], { contexto: "amigos", d: true }),
  q("ami-loucura", "decisoes", 1, "Um amigo conta que vai fazer uma loucura. O que {voce} faz?", ["Ir junto", "Tentar convencer a desistir", "Pedir detalhes antes", "Filmar tudo"], { contexto: "amigos", d: true }),
  q("ami-mensagens", "social", 1, "No grupo de mensagens dos amigos, {voce} costuma…", ["Mandar áudio longo", "Só reagir com figurinha", "Ler tudo e não responder", "Responder tudo na hora"], { contexto: "amigos", d: true }),
  q("ami-afastar", "relacoes", 3, "O que faria {voce} se afastar de um amigo?", ["Uma mentira", "Falta de apoio num momento difícil", "Fofoca", "Nunca estar disponível"], { contexto: "amigos" }),
  q("ami-comemorar", "tempo-livre", 1, "Para comemorar com os amigos, {voce} escolhe…", ["Bar ou restaurante", "Festa em casa", "Um programa ao ar livre", "Jogo ou maratona de filmes"], { contexto: "amigos" }),
  q("ami-esqueceu", "relacoes", 2, "Se um amigo esquecer o aniversário, {voce}…", ["Cobra com humor", "Finge que não ligou", "Guarda a mágoa em silêncio", "Nem percebe"], { contexto: "amigos" }),
  q("ami-roupa", "dinheiro", 1, "Quando um amigo pede uma roupa emprestada, {voce}…", ["Empresta sem problema", "Só empresta para quem é muito próximo", "Nunca empresta roupa", "Empresta e cobra de volta"], { contexto: "amigos", d: true }),
  q("ami-noite", "imprevistos", 1, "Numa saída à noite, {voce} é quem…", ["Leva todo mundo em casa", "Anima o grupo", "Vai embora primeiro", "Inventa de esticar"], { contexto: "amigos", d: true }),
  q("ami-republica", "rotina", 1, "Dividindo apartamento com amigos, {voce} seria quem…", ["Organiza a limpeza", "Faz a comida", "Esquece as contas", "Faz a festa"], { contexto: "amigos", d: true }),
  q("ami-sinceridade", "decisoes", 2, "Um amigo pede sinceridade sobre uma roupa feia. O que {voce} faz?", ["Dizer a verdade na lata", "Sugerir outra com jeitinho", "Elogiar mesmo assim", "Desconversar"], { contexto: "amigos" }),
  q("ami-saudade", "emocoes", 2, "Quanto tempo {voce} aguenta sem ver os amigos?", ["Uma semana, no máximo", "Um mês, tranquilo", "Meses, desde que tenha mensagem", "Muito tempo, sem problema"], { contexto: "amigos" }),
  q("ami-briga", "relacoes", 3, "Numa discussão entre dois amigos, {voce} costuma…", ["Tomar partido", "Tentar reconciliar", "Ficar de fora", "Chamar os dois para conversar"], { contexto: "amigos" }),
  q("ami-jogo", "gostos", 1, "O jogo favorito de {voce} numa noite com amigos:", ["Cartas ou tabuleiro", "Videogame", "Mímica ou adivinhação", "Karaokê"], { contexto: "amigos", d: true }),
  q("ami-valor", "futuro", 3, "O que {voce} mais valoriza numa amizade?", ["Lealdade", "Humor", "Estar presente", "Sinceridade"], { contexto: "amigos" }),
  // ——— Crush (leve, sem conteúdo sexual) ———
  q("cru-encontro", "tempo-livre", 1, "Num primeiro encontro, {voce} prefere…", ["Jantar", "Cinema", "Café e conversa", "Passeio ao ar livre"], { contexto: "crush" }),
  q("cru-interesse", "relacoes", 2, "Para mostrar interesse em alguém, {voce} costuma…", ["Puxar assunto sem parar", "Mandar indiretas", "Esperar o outro dar o primeiro passo", "Chamar para sair direto"], { contexto: "crush" }),
  q("cru-bom-dia", "social", 1, "A mensagem de bom-dia ideal para {voce} é…", ["Um texto carinhoso", "Um meme", "Um áudio", "Nenhuma, só no encontro"], { contexto: "crush", d: true }),
  q("cru-atencao", "gostos", 1, "O que chama a atenção de {voce} primeiro em alguém?", ["O sorriso", "O jeito de conversar", "O estilo", "O senso de humor"], { contexto: "crush" }),
  q("cru-programa", "tempo-livre", 1, "Um programa a dois perfeito para {voce}:", ["Sofá, filme e pipoca", "Viagem de fim de semana", "Show ou festa", "Cozinhar juntos"], { contexto: "crush" }),
  q("cru-ciume", "emocoes", 2, "Quando sente ciúme, {voce} costuma…", ["Falar na hora", "Ficar em silêncio", "Fingir que não é nada", "Fazer piada para disfarçar"], { contexto: "crush" }),
  q("cru-presente", "gostos", 2, "Um presente que conquistaria {voce}:", ["Flores ou chocolate", "Uma carta", "Uma experiência juntos", "Algo que mostre atenção aos detalhes"], { contexto: "crush" }),
  q("cru-briga", "relacoes", 3, "Numa briga com quem gosta, {voce} costuma…", ["Pedir desculpas primeiro", "Esperar o outro", "Resolver na conversa, na hora", "Dar um tempo e voltar"], { contexto: "crush" }),
  q("cru-musica", "gostos", 1, "A música que {voce} dedicaria a alguém especial seria…", ["Romântica clássica", "Sertanejo", "Pop do momento", "Algo que ninguém conhece"], { contexto: "crush", d: true }),
  q("cru-publico", "emocoes", 2, "Sobre demonstrar carinho em público, {voce}…", ["Adora, sem vergonha", "Só um pouquinho", "Prefere no particular", "Fica sem graça"], { contexto: "crush" }),
  q("cru-data", "futuro", 2, "Numa data especial a dois, {voce} planejaria…", ["Uma surpresa elaborada", "Um jantar especial", "Uma viagem", "Algo simples em casa"], { contexto: "crush" }),
  q("cru-conta", "dinheiro", 1, "Sobre a conta do encontro, {voce} prefere…", ["Dividir", "Pagar tudo", "Revezar a cada encontro", "Quem convidou paga"], { contexto: "crush" }),
  q("cru-mico", "decisoes", 1, "O maior mico que {voce} pagaria por alguém especial:", ["Cantar em público", "Dançar mesmo sem saber", "Uma declaração na frente de todo mundo", "Nenhum, mico não é comigo"], { contexto: "crush", d: true }),
  q("cru-responder", "rotina", 1, "Quanto tempo {voce} demora para responder o crush?", ["Na hora, sem joguinho", "Alguns minutos, para disfarçar", "Horas, de propósito", "Depende do humor"], { contexto: "crush", d: true }),
  q("cru-desinteresse", "futuro", 3, "O que faria {voce} perder o interesse em alguém?", ["Falta de educação", "Falta de assunto", "Arrogância", "Demora para responder"], { contexto: "crush" }),
];

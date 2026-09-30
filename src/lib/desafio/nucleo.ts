/**
 * Núcleo de perguntas do perfil. Montado a partir dos traços: cada pergunta
 * mede UM traço, e cada opção tem um peso de -2 a +2 (positivo puxa para o
 * primeiro polo do traço, negativo para o segundo).
 *
 * Traços (primeiro polo / segundo polo):
 *   social   Expansivo / Reservado      ritmo    Planejador / Espontâneo
 *   decisao  Razão / Coração            reacao   Calmo / Intenso
 *   novidade Explorador / Caseiro       foco     Independente / Cuidador
 *
 * `{voce}` vira "você" para quem responde sobre si e o primeiro nome para
 * quem tenta prever. As opções são neutras (sem gênero) e servem aos dois casos.
 * Perguntas com `contexto` só entram em desafios daquela relação.
 */
export type Traco = "social" | "ritmo" | "decisao" | "reacao" | "novidade" | "foco";
export type Relacao = "familia" | "amigos" | "crush";
type Peso = -2 | -1 | 1 | 2;
export type PerguntaNucleo = { chave: string; traco: Traco; texto: string; opcoes: [string, string, string, string]; pesos: [Peso, Peso, Peso, Peso]; contexto?: Relacao; d?: true };

export const TRACOS: Record<Traco, { nome: string; polos: [string, string] }> = {
  social: { nome: "Social", polos: ["Expansivo", "Reservado"] },
  ritmo: { nome: "Ritmo", polos: ["Planejador", "Espontâneo"] },
  decisao: { nome: "Decisão", polos: ["Razão", "Coração"] },
  reacao: { nome: "Reação", polos: ["Calmo", "Intenso"] },
  novidade: { nome: "Novidade", polos: ["Explorador", "Caseiro"] },
  foco: { nome: "Foco", polos: ["Independente", "Cuidador"] },
};
export const ORDEM_TRACOS: Traco[] = ["social", "ritmo", "decisao", "reacao", "novidade", "foco"];

type Linha = [string, string, [string, string, string, string], [Peso, Peso, Peso, Peso], (Relacao | "d")?];
const monta = (traco: Traco, prefixo: string, linhas: Linha[]): PerguntaNucleo[] => linhas.map(([sufixo, texto, opcoes, pesos, extra]) => ({
  chave: `${prefixo}-${sufixo}`, traco, texto, opcoes, pesos,
  ...(extra === "d" ? { d: true as const } : extra ? { contexto: extra } : {}),
}));

const SOCIAL = monta("social", "soc", [
  ["festa", "Ao chegar numa festa onde conhece pouca gente, {voce}…", ["Puxa conversa com quem estiver perto", "Procura alguém conhecido", "Fica num canto observando", "Se enturma aos poucos"], [2, -1, -2, 1]],
  ["recarga", "Depois de uma semana cansativa, o que recarrega {voce}?", ["Sair com a turma", "Um programa com poucas pessoas", "Ficar em casa, sem ninguém", "Qualquer lugar com gente animada"], [2, -1, -2, 1]],
  ["elevador", "Num elevador com um desconhecido, {voce}…", ["Puxa assunto", "Sorri e fica em silêncio", "Olha o celular", "Comenta sobre o tempo"], [2, -1, -2, 1]],
  ["resolver", "Quando precisa resolver algo, {voce} prefere…", ["Ligar na hora", "Mandar mensagem", "Resolver por aplicativo, sem falar com ninguém", "Ir pessoalmente"], [2, -1, -2, 1]],
  ["atencao", "Ser o centro das atenções, para {voce}, é…", ["Ótimo", "Bom, de vez em quando", "Desconfortável", "Um pesadelo"], [2, 1, -1, -2]],
  ["grupo-novo", "Num grupo novo de pessoas, {voce} costuma…", ["Puxar conversa", "Observar antes de falar", "Procurar alguém conhecido", "Ficar à vontade logo de cara"], [2, -2, -1, 1]],
  ["aniversario", "No próprio aniversário, {voce} prefere…", ["Festa grande", "Jantar com poucas pessoas", "Algo diferente com a turma", "Que ninguém lembre"], [2, -1, 1, -2]],
  ["roda", "Numa roda de conversa, {voce} costuma…", ["Falar mais do que ouvir", "Ouvir mais do que falar", "Contar as histórias engraçadas", "Falar só quando perguntam"], [2, -2, 1, -1]],
  ["convite", "Chega um convite para uma festa cheia de gente. O que {voce} faz?", ["Topa: quanto mais gente, melhor", "Vai só se um amigo for junto", "Recusa e fica em casa", "Vai e faz amizade nova"], [2, -1, -2, 1]],
  ["redes", "Nas redes sociais, {voce} costuma…", ["Postar com frequência", "Só observar", "Postar só momentos especiais", "Comentar em tudo"], [2, -2, -1, 1]],
  ["equipe", "Num trabalho em equipe, {voce} prefere…", ["Apresentar para todos", "Organizar por trás", "Pesquisar em silêncio", "Animar o grupo"], [2, -1, -2, 1]],
  ["fila", "Um desconhecido puxa conversa com {voce} na fila. O que acontece?", ["Rende um papo longo", "Responde e volta ao celular", "Conversa um pouco, por educação", "Termina trocando contato"], [2, -2, -1, 1]],
  ["dia-cheio", "Depois de um dia inteiro com muita gente, {voce} fica…", ["Com mais energia", "Bem, mas precisando descansar", "Sem energia nenhuma", "Querendo esticar o programa"], [2, -1, -2, 1]],
  ["mesa", "Num restaurante, {voce} prefere uma mesa…", ["No meio do salão, perto do movimento", "No canto, mais reservada", "Na varanda, vendo gente passar", "Tanto faz, desde que seja tranquila"], [2, -2, 1, -1]],
  ["publico", "Falar em público, para {voce}, é…", ["Natural", "Tranquilo, com preparo", "Um desafio", "Algo a evitar"], [2, 1, -1, -2]],
  ["circulo", "O círculo de amizades de {voce} é…", ["Enorme: conhece gente em todo lugar", "Médio, com vários grupos", "Pequeno e fiel", "Pouquíssimas pessoas"], [2, 1, -1, -2]],
  ["grupo-msg", "No grupo de mensagens, {voce} costuma…", ["Puxar os assuntos", "Responder quando marcam", "Só ler", "Mandar figurinha em tudo"], [2, -1, -2, 1], "d"],
  ["karaoke", "Num karaokê, {voce}…", ["Pega o microfone primeiro", "Canta se todo mundo cantar", "Só assiste", "Canta baixinho no coro"], [2, 1, -2, -1], "d"],
  ["noticia", "Chega uma notícia muito boa. O que {voce} faz primeiro?", ["Conta para todo mundo", "Conta só para uma pessoa", "Guarda um pouco para si", "Posta nas redes"], [2, -1, -2, 1]],
  ["vizinhos", "Com os vizinhos, {voce}…", ["Conhece todo mundo pelo nome", "Cumprimenta e conversa às vezes", "Só cumprimenta", "Evita encontrar no elevador"], [2, 1, -1, -2], "d"],
  ["fam-reuniao", "Numa reunião de família, {voce} é quem…", ["Conta as histórias", "Ajuda na cozinha, em silêncio", "Anima as crianças", "Some para o sofá"], [2, -1, 1, -2], "familia"],
  ["fam-domingo", "No almoço de domingo, {voce} prefere…", ["Casa cheia de parentes", "Só a família mais próxima", "Almoçar e sair logo", "Chamar os amigos também"], [2, -1, -2, 1], "familia"],
  ["ami-grupo", "No grupo de amigos, {voce} é quem…", ["Marca os encontros", "Aparece quando chamam", "Anima a conversa", "Some por um tempo e reaparece"], [2, -1, 1, -2], "amigos"],
  ["ami-noite", "Numa saída à noite com os amigos, {voce}…", ["Fica até o fim", "Vai embora primeiro", "Puxa gente nova para a roda", "Fica com o grupo de sempre"], [2, -2, 1, -1], "amigos"],
  ["cru-encontro", "Num primeiro encontro, {voce} costuma…", ["Falar sem parar", "Deixar o outro falar", "Fazer muitas perguntas", "Ficar sem graça no começo"], [2, -1, 1, -2], "crush"],
  ["cru-interesse", "Para mostrar interesse em alguém, {voce}…", ["Chama para sair direto", "Manda indiretas", "Puxa assunto sem parar", "Espera o outro dar o primeiro passo"], [2, -1, 1, -2], "crush"],
]);

const RITMO = monta("ritmo", "rit", [
  ["viagem", "Uma viagem daqui a um mês. Quando {voce} começa a organizar?", ["No mesmo dia", "Uma semana antes", "Na véspera", "Resolve tudo chegando lá"], [2, 1, -1, -2]],
  ["mala", "A mala de viagem de {voce} é feita…", ["Com lista, dias antes", "Na noite anterior", "Uma hora antes de sair", "Com tudo jogado de qualquer jeito"], [2, 1, -1, -2], "d"],
  ["agenda", "Para lembrar dos compromissos, {voce}…", ["Usa agenda ou aplicativo", "Anota num papel", "Confia na memória", "Esquece e corre atrás depois"], [2, 1, -1, -2]],
  ["sabado", "Um sábado livre. Como {voce} decide o que fazer?", ["Já tinha planejado durante a semana", "Pensa em algumas opções pela manhã", "Vê o que aparecer", "Topa o primeiro convite"], [2, 1, -1, -2]],
  ["prazo", "Diante de um prazo daqui a duas semanas, {voce}…", ["Começa no primeiro dia", "Divide em etapas", "Deixa para a última semana", "Faz tudo na véspera"], [2, 1, -1, -2]],
  ["mesa", "Como fica o lugar onde {voce} trabalha ou estuda?", ["Impecável", "Organizado, do próprio jeito", "Uma bagunça organizada", "Uma bagunça mesmo"], [2, 1, -1, -2]],
  ["despertador", "Quando o despertador toca, {voce}…", ["Levanta na hora", "Já acordou antes dele", "Adia uma vez", "Adia várias vezes"], [1, 2, -1, -2], "d"],
  ["mercado", "No mercado, {voce}…", ["Leva lista e segue à risca", "Leva lista, mas pega extras", "Vai vendo o que precisa", "Volta sem o que foi buscar"], [2, 1, -1, -2], "d"],
  ["gastos", "Como {voce} controla os gastos?", ["Planilha ou aplicativo", "Olha o saldo toda semana", "De cabeça, mais ou menos", "Controle? Que controle?"], [2, 1, -1, -2]],
  ["jantar", "Para escolher onde jantar, {voce}…", ["Reserva com antecedência", "Pesquisa antes de sair", "Anda e entra onde der vontade", "Segue a sugestão de alguém na hora"], [2, 1, -2, -1]],
  ["plano-b", "O plano deu errado na última hora. O que {voce} faz?", ["Já tem um plano B", "Reorganiza tudo com calma", "Improvisa na hora", "Deixa rolar"], [2, 1, -2, -1]],
  ["rotina", "Quanto {voce} gosta de rotina?", ["Muito: rotina traz paz", "Um pouco, com espaço para mudar", "Pouco: rotina entedia", "Nada: cada dia é um dia"], [2, 1, -1, -2]],
  ["horario", "Num encontro marcado, {voce} chega…", ["Antes da hora, sempre", "No horário", "Com um pouco de atraso", "Muito depois, com uma boa desculpa"], [2, 1, -1, -2]],
  ["presente", "Presente de aniversário de alguém querido: quando {voce} compra?", ["Semanas antes", "Alguns dias antes", "No próprio dia", "Depois, com um pedido de desculpas"], [2, 1, -1, -2]],
  ["receita", "Na cozinha, {voce}…", ["Segue a receita à risca", "Segue a receita com ajustes", "Usa a receita só como ideia", "Improvisa com o que tiver"], [2, 1, -1, -2]],
  ["ferias", "Nas férias, {voce} prefere…", ["Roteiro dia a dia", "Algumas atrações marcadas", "Decidir cada dia pela manhã", "Nenhum plano: ver no que dá"], [2, 1, -1, -2]],
  ["filme", "Para escolher um filme, {voce}…", ["Tem uma lista pronta", "Lê críticas antes", "Começa o primeiro que aparecer", "Escolhe pela capa"], [2, 1, -2, -1]],
  ["mudanca", "Quando os planos mudam de repente, {voce}…", ["Sente um incômodo", "Precisa de um tempo para reorganizar", "Se adapta rápido", "Adora: melhor que o plano original"], [2, 1, -1, -2]],
  ["ano", "Pensando no próximo ano, {voce}…", ["Tem metas escritas", "Tem uma ideia geral", "Pensa nisso mais tarde", "Vive um dia de cada vez"], [2, 1, -1, -2]],
  ["contas", "As contas do mês de {voce} são pagas…", ["No débito automático", "Assim que chegam", "No dia do vencimento", "Quando lembrar"], [2, 1, -1, -2]],
  ["fam-festa", "Nas festas de família, {voce} é quem…", ["Organiza tudo com antecedência", "Ajuda no que pedirem", "Chega na hora e vê o que falta", "Aparece de surpresa"], [2, 1, -1, -2], "familia"],
  ["fam-licao", "Na infância, {voce} fazia a lição de casa…", ["Assim que chegava da escola", "Antes do jantar", "À noite, correndo", "Na manhã seguinte, no caminho"], [2, 1, -1, -2], "familia"],
  ["ami-viagem", "Numa viagem com amigos, {voce} é quem…", ["Planeja o roteiro", "Cuida das reservas", "Topa tudo", "Esquece alguma coisa"], [2, 1, -1, -2], "amigos"],
  ["ami-encontro", "Para um encontro da turma, {voce} prefere…", ["Marcar com uma semana de antecedência", "Combinar no dia anterior", "Chamar na hora", "Aparecer sem avisar"], [2, 1, -1, -2], "amigos"],
  ["cru-data", "Numa data especial a dois, {voce}…", ["Planeja cada detalhe", "Reserva um lugar especial", "Decide no dia", "Surpreende com algo improvisado"], [2, 1, -1, -2], "crush"],
  ["cru-primeiro", "Para o primeiro encontro, {voce}…", ["Já define lugar e horário", "Sugere duas opções", "Deixa o outro escolher na hora", "Vê o que rolar"], [2, 1, -1, -2], "crush"],
]);

const DECISAO = monta("decisao", "dec", [
  ["primeiro", "Diante de uma decisão importante, o que {voce} faz primeiro?", ["Lista prós e contras", "Segue a intuição", "Pesquisa muito", "Ouve o que sente"], [2, -2, 1, -1]],
  ["compra", "Numa compra grande, o que pesa mais para {voce}?", ["Custo-benefício", "Avaliações de quem comprou", "Amor à primeira vista", "A história por trás do produto"], [2, 1, -2, -1]],
  ["conselho", "Quando um amigo pede um conselho, {voce}…", ["Diz a verdade, mesmo que doa", "Mostra os fatos", "Acolhe antes de opinar", "Diz o que o coração manda"], [2, 1, -1, -2]],
  ["filme", "Num filme, o que mais prende {voce}?", ["Uma trama bem amarrada", "Um mistério para desvendar", "Personagens que emocionam", "Uma história de amor"], [2, 1, -1, -2]],
  ["discussao", "Numa discussão, {voce} tende a…", ["Argumentar com fatos", "Buscar um meio-termo lógico", "Pensar em como o outro se sente", "Falar o que sente, sem filtro"], [2, 1, -1, -2]],
  ["emprego", "Duas propostas de trabalho. {voce} escolheria…", ["A que paga mais", "A com melhor carreira", "A com pessoas de quem gosta", "A que faz o coração bater mais forte"], [2, 1, -1, -2]],
  ["regra", "Diante de uma regra injusta, {voce}…", ["Segue a regra até mudarem", "Questiona com argumentos", "Quebra a regra se for para ajudar alguém", "Se revolta na hora"], [2, 1, -1, -2]],
  ["presente", "Para escolher um presente, {voce} pensa em…", ["Algo útil", "Algo que a pessoa pediu", "Algo com significado", "Algo que emocione"], [2, 1, -1, -2]],
  ["desculpa", "Quando alguém erra com {voce} e pede desculpas…", ["Avalia se o erro vai se repetir", "Conversa para entender", "Perdoa logo", "Perdoa, mas sente por dias"], [2, 1, -1, -2]],
  ["destino", "Para escolher o destino das férias, {voce}…", ["Compara preços e roteiros", "Lê avaliações", "Vai onde sempre sonhou", "Segue a vontade do momento"], [2, 1, -2, -1]],
  ["choque", "Diante de uma notícia chocante, {voce} primeiro…", ["Checa se é verdade", "Busca mais detalhes", "Pensa nas pessoas afetadas", "Se emociona"], [2, 1, -1, -2]],
  ["mentira", "Uma mentira para poupar alguém, para {voce}, é…", ["Errada, sempre", "Aceitável em raros casos", "Muitas vezes necessária", "Um ato de carinho"], [2, 1, -1, -2]],
  ["voto", "Numa escolha em grupo, {voce} vota…", ["Na opção mais lógica", "Na mais prática", "Na que agrada a maioria", "Na que emociona"], [2, 1, -1, -2]],
  ["depois", "Depois de uma decisão difícil, {voce}…", ["Segue em frente: foi a melhor escolha possível", "Revisa o que poderia melhorar", "Pensa em como os outros se sentiram", "Repassa tudo no coração"], [2, 1, -1, -2]],
  ["serie", "Que tipo de série conquista {voce}?", ["Suspense e investigação", "Documentário", "Drama", "Romance"], [2, 1, -1, -2], "d"],
  ["bicho", "Um amigo quer adotar um bicho sem ter espaço em casa. {voce} diria…", ["Que não é prático", "Para planejar primeiro", "Que o amor dá um jeito", "Para seguir o coração com cuidado"], [2, 1, -2, -1]],
  ["choro", "Quando alguém chora perto de {voce}, a reação é…", ["Tentar resolver o problema", "Perguntar o que aconteceu", "Abraçar", "Chorar junto"], [2, 1, -1, -2]],
  ["emprestimo", "Um amigo pede dinheiro emprestado. {voce}…", ["Avalia se ele consegue pagar", "Empresta com data combinada", "Empresta sem pensar duas vezes", "Empresta mesmo sem ter sobrando"], [2, 1, -1, -2]],
  ["musica", "A música favorita de {voce} é aquela que…", ["Tem uma letra inteligente", "Tem uma produção impecável", "Lembra alguém especial", "Faz chorar"], [2, 1, -1, -2], "d"],
  ["confia", "Para decidir se algo vale a pena, {voce} confia mais em…", ["Números e fatos", "Experiência de quem já fez", "Pressentimento", "O que sente na hora"], [2, 1, -1, -2]],
  ["fam-briga", "Numa briga entre parentes, {voce}…", ["Aponta quem tem razão", "Propõe uma solução justa", "Acalma os ânimos", "Fica do lado de quem está sofrendo"], [2, 1, -1, -2], "familia"],
  ["fam-objeto", "Um objeto antigo da família, para {voce}, vale pelo…", ["Valor que tem hoje", "Uso que ainda tem", "Significado", "Lembrança que traz"], [2, 1, -1, -2], "familia"],
  ["ami-escolha", "Um amigo faz uma escolha que {voce} acha errada. O que acontece?", ["Diz com todas as letras", "Mostra os riscos", "Apoia mesmo assim", "Apoia sem questionar"], [2, 1, -1, -2], "amigos"],
  ["ami-prova", "Para {voce}, uma amizade verdadeira se prova com…", ["Coerência", "Conselhos sinceros", "Presença nos momentos difíceis", "Carinho constante"], [2, 1, -1, -2], "amigos"],
  ["cru-conquista", "O que mais conquista {voce} em alguém?", ["Inteligência", "Conversa interessante", "Carinho", "Um olhar que emociona"], [2, 1, -1, -2], "crush"],
  ["cru-declarar", "Na hora de se declarar, {voce}…", ["Pensa bem antes de falar", "Espera o momento certo", "Fala quando dá vontade", "Se declara no impulso"], [2, 1, -1, -2], "crush"],
]);

const REACAO = monta("reacao", "rea", [
  ["transito", "Preso num trânsito parado, {voce}…", ["Coloca uma música e relaxa", "Aproveita para ligar para alguém", "Fica impaciente", "Buzina e reclama"], [2, 1, -1, -2]],
  ["critica", "Ao receber uma crítica, {voce}…", ["Ouve e reflete", "Pede exemplos", "Se defende na hora", "Remói por dias"], [2, 1, -2, -1]],
  ["filme", "Num filme emocionante, {voce}…", ["Nem se abala", "Segura o choro", "Chora escondido", "Chora sem vergonha"], [2, 1, -1, -2]],
  ["atraso", "Um amigo atrasa uma hora. {voce}…", ["Espera tranquilamente", "Manda mensagem perguntando", "Perde a paciência", "Vai embora"], [2, 1, -2, -1]],
  ["jogo", "Vendo um jogo importante, {voce}…", ["Assiste com calma", "Comenta os lances", "Grita a cada lance", "Levanta a cada jogada"], [2, 1, -2, -1], "d"],
  ["alegria", "Quando recebe uma notícia muito boa, {voce}…", ["Sorri e segue o dia", "Conta com calma para alguém", "Pula de alegria", "Liga para todo mundo"], [2, 1, -2, -1]],
  ["injustica", "Vendo alguém ser tratado com injustiça na rua, {voce}…", ["Observa e avalia", "Intervém com calma", "Toma as dores na hora", "Fica com raiva por horas"], [2, 1, -2, -1]],
  ["vespera", "Na véspera de algo importante, {voce}…", ["Dorme tranquilamente", "Revisa e vai deitar", "Rola na cama a noite toda", "Repassa tudo mil vezes"], [2, 1, -2, -1]],
  ["discussao", "Numa discussão acalorada, {voce}…", ["Mantém o tom de voz", "Pede um tempo", "Levanta a voz", "Sai batendo a porta"], [2, 1, -1, -2]],
  ["erro", "Quando comete um erro bobo, {voce}…", ["Ri e segue", "Corrige e esquece", "Fica se culpando", "Fica com raiva de si"], [2, 1, -1, -2]],
  ["surpresa", "Uma festa surpresa para {voce} seria…", ["Uma alegria tranquila", "Legal, se for pequena", "Uma explosão de emoção", "Um susto enorme"], [2, 1, -2, -1]],
  ["fila", "Alguém fura a fila. O que {voce} faz?", ["Deixa para lá", "Avisa com educação", "Reclama na hora", "Comenta alto com quem está perto"], [2, 1, -2, -1]],
  ["humor", "O humor de {voce} ao longo do dia é…", ["Estável, quase sempre igual", "Varia pouco", "Muda com facilidade", "Uma montanha-russa"], [2, 1, -1, -2]],
  ["pressao", "Com prazo apertado e muita pressão, {voce}…", ["Mantém a cabeça fria", "Organiza e segue", "Fica a mil", "Trava no começo"], [2, 1, -2, -1]],
  ["saudade", "Quando sente saudade de alguém, {voce}…", ["Lembra com carinho e segue", "Manda uma mensagem", "Liga na hora", "Fica mexido o dia todo"], [2, 1, -1, -2]],
  ["susto", "Um barulho alto de repente. {voce}…", ["Nem se mexe", "Olha para ver o que foi", "Dá um pulo", "Grita"], [2, 1, -1, -2], "d"],
  ["elogio", "Ao receber um elogio em público, {voce}…", ["Agradece com naturalidade", "Sorri e segue", "Fica com o rosto vermelho", "Não sabe onde enfiar a cara"], [2, 1, -1, -2]],
  ["voo", "O voo foi cancelado. O que {voce} faz?", ["Procura outra opção com calma", "Aceita e espera", "Reclama no balcão", "Desabafa nas redes"], [2, 1, -2, -1]],
  ["fofo", "Vendo um vídeo fofo de bicho, {voce}…", ["Acha bonitinho e passa", "Curte", "Manda para todo mundo", "Se derrete por minutos"], [2, 1, -1, -2], "d"],
  ["derrota", "Quando perde num jogo, {voce}…", ["Parabeniza quem ganhou", "Pede revanche com calma", "Fecha a cara", "Joga o controle longe"], [2, 1, -1, -2], "d"],
  ["fam-conselho", "Quando alguém da família dá um conselho que {voce} não pediu…", ["Ouve com calma", "Agradece e faz do próprio jeito", "Retruca na hora", "Fica remoendo o dia todo"], [2, 1, -2, -1], "familia"],
  ["fam-discussao", "Numa discussão em família, {voce}…", ["É a voz da calma", "Espera passar", "Entra de cabeça", "Se emociona"], [2, 1, -2, -1], "familia"],
  ["ami-esqueceu", "Um amigo esquece o seu aniversário. {voce}…", ["Nem liga", "Brinca com isso", "Guarda a mágoa", "Cobra na hora"], [2, 1, -1, -2], "amigos"],
  ["ami-briga", "Numa briga entre amigos, {voce}…", ["Mantém a calma e media", "Espera esfriar", "Toma partido com força", "Sofre pelos dois lados"], [2, 1, -2, -1], "amigos"],
  ["cru-ciume", "Quando sente ciúme, {voce}…", ["Respira e deixa passar", "Conversa com calma depois", "Fala na hora", "Finge que não é nada, mas ferve por dentro"], [2, 1, -2, -1], "crush"],
  ["cru-resposta", "Esperando a resposta de uma mensagem do crush, {voce}…", ["Segue o dia normalmente", "Olha o celular de vez em quando", "Checa a cada minuto", "Relê a própria mensagem mil vezes"], [2, 1, -2, -1], "crush"],
]);

const NOVIDADE = monta("novidade", "nov", [
  ["prato", "No restaurante, {voce}…", ["Pede o prato mais diferente", "Prova algo novo às vezes", "Pede o de sempre", "Pede o que já conhece da casa"], [2, 1, -2, -1]],
  ["ferias", "Férias perfeitas para {voce} são…", ["Num país desconhecido", "Numa cidade nova no Brasil", "No lugar de sempre", "Em casa, descansando"], [2, 1, -1, -2]],
  ["musicas", "As músicas que {voce} ouve são…", ["Sempre descobertas novas", "Uma mistura de novas e antigas", "As favoritas de sempre", "As que tocam no rádio"], [2, 1, -2, -1]],
  ["cidade", "Mudar de cidade, para {voce}, seria…", ["Uma aventura", "Uma boa oportunidade", "Difícil, mas possível", "Impensável"], [2, 1, -1, -2]],
  ["sabado", "Um sábado ideal para {voce} é…", ["Conhecer um lugar novo", "Experimentar uma atividade diferente", "Rever os lugares favoritos", "Sofá e série"], [2, 1, -1, -2]],
  ["caminho", "Indo para um lugar conhecido, {voce}…", ["Testa caminhos novos", "Muda de vez em quando", "Faz sempre o mesmo caminho", "Segue o aplicativo"], [2, 1, -2, -1]],
  ["aprender", "Aprender algo completamente novo, para {voce}, é…", ["Um vício", "Uma alegria", "Bom, com calma", "Cansativo"], [2, 1, -1, -2]],
  ["comida", "Diante de uma comida estranha, {voce}…", ["Prova na hora", "Prova um pedacinho", "Pergunta o que é e desiste", "Recusa"], [2, 1, -1, -2], "d"],
  ["estilo", "No jeito de se vestir, {voce}…", ["Arrisca tendências", "Varia um pouco", "Usa o que já funciona", "Repete o mesmo estilo sempre"], [2, 1, -1, -2]],
  ["app", "Sai um aplicativo novo que todo mundo comenta. {voce}…", ["Baixa no primeiro dia", "Testa depois de ver opiniões", "Espera muito tempo", "Nem baixa"], [2, 1, -1, -2]],
  ["trabalho", "No trabalho, {voce} prefere…", ["Projetos novos o tempo todo", "Uma novidade de vez em quando", "Tarefas que já domina", "A mesma rotina sempre"], [2, 1, -1, -2]],
  ["desconhecida", "Numa cidade desconhecida, {voce}…", ["Se perde de propósito", "Explora os bairros", "Visita os pontos famosos", "Fica perto do hotel"], [2, 1, -1, -2]],
  ["filme", "Na hora de ver um filme, {voce}…", ["Busca algo que ninguém viu", "Arrisca um lançamento", "Revê um favorito", "Escolhe o mais famoso"], [2, 1, -2, -1]],
  ["radical", "Saltar de paraquedas, para {voce}, é…", ["Um sonho", "Algo para um dia", "Só assistindo", "Nunca"], [2, 1, -1, -2], "d"],
  ["casa", "A casa de {voce} está sempre…", ["Com móveis mudando de lugar", "Com algo novo de vez em quando", "Do mesmo jeito há anos", "Aconchegante e familiar"], [2, 1, -2, -1]],
  ["feira", "Numa feira ou festival de comida, {voce}…", ["Prova de tudo", "Escolhe algumas novidades", "Vai direto no que já conhece", "Fica no básico"], [2, 1, -2, -1], "d"],
  ["idioma", "Aprender um idioma novo, para {voce}, seria…", ["Empolgante", "Interessante", "Trabalhoso", "Desnecessário"], [2, 1, -1, -2]],
  ["semana", "Uma semana igual à outra, para {voce}, é…", ["Um tédio", "Aceitável de vez em quando", "Confortável", "Perfeita"], [2, 1, -1, -2]],
  ["tecnologia", "Com tecnologia, {voce}…", ["Testa toda novidade", "Atualiza quando precisa", "Usa o mesmo celular até quebrar", "Resiste às mudanças"], [2, 1, -1, -2]],
  ["visual", "Mudar o visual radicalmente, para {voce}, é…", ["Algo que faz sempre", "Uma vez ou outra", "Raro", "Nunca, nem pensar"], [2, 1, -1, -2]],
  ["fam-ferias", "Nas férias em família, {voce} sugere…", ["Um destino que ninguém conhece", "Um lugar novo, mas tranquilo", "A casa de sempre", "Ficar em casa, todos juntos"], [2, 1, -1, -2], "familia"],
  ["fam-receita", "Nas receitas de família, {voce}…", ["Inventa versões novas", "Muda um tempero", "Segue exatamente como a avó fazia", "Mantém a tradição"], [2, 1, -2, -1], "familia"],
  ["ami-saida", "Numa saída com amigos, {voce} sugere…", ["Um lugar que acabou de abrir", "Um bar diferente", "O de sempre", "Um lugar que todo mundo gosta"], [2, 1, -2, -1], "amigos"],
  ["ami-destino", "Uma viagem com a turma para um lugar desconhecido. {voce}…", ["Topa sem pensar", "Topa depois de ver o roteiro", "Prefere um lugar conhecido", "Recusa"], [2, 1, -1, -2], "amigos"],
  ["cru-encontro", "Um encontro ideal para {voce} seria…", ["Uma aventura, como uma trilha", "Um lugar novo da cidade", "O restaurante favorito", "Filme em casa"], [2, 1, -1, -2], "crush"],
  ["cru-relacao", "Num relacionamento, {voce} gosta de…", ["Surpresas o tempo todo", "Novidades de vez em quando", "Rituais do casal", "Tudo previsível e seguro"], [2, 1, -1, -2], "crush"],
]);

const FOCO = monta("foco", "foc", [
  ["problema", "Diante de um problema, {voce}…", ["Resolve sem pedir ajuda", "Pesquisa antes de envolver alguém", "Pede a opinião de quem gosta", "Pensa primeiro em como afeta os outros"], [2, 1, -1, -2]],
  ["doente", "Um amigo está doente. {voce}…", ["Manda mensagem desejando melhoras", "Deixa o amigo descansar", "Leva uma sopa", "Cuida como se fosse da família"], [1, 2, -1, -2]],
  ["tempo", "O tempo livre de {voce} é mais…", ["Para si", "Metade para si, metade para os outros", "Com quem precisa", "Para ajudar alguém"], [2, 1, -1, -2]],
  ["viagem", "Viajar sem companhia, para {voce}, seria…", ["Perfeito", "Uma boa experiência", "Estranho", "Sem graça: bom é dividir"], [2, 1, -1, -2]],
  ["decisoes", "Nas decisões da vida, {voce}…", ["Decide sem consultar ninguém", "Ouve, mas decide", "Pensa em como afeta a família", "Coloca os outros em primeiro lugar"], [2, 1, -1, -2]],
  ["triste", "Quando alguém que {voce} ama está triste…", ["Dá espaço", "Manda uma mensagem", "Aparece com um mimo", "Larga tudo para ficar junto"], [2, 1, -1, -2]],
  ["extra", "Um dinheiro extra inesperado. {voce} gastaria com…", ["Algo só para si", "Uma experiência para si", "Presentes para quem ama", "Ajudar alguém que precisa"], [2, 1, -1, -2]],
  ["autonomia", "No trabalho, {voce} prefere…", ["Total autonomia", "Liberdade, com apoio quando precisa", "Trabalhar em dupla", "Cuidar da equipe"], [2, 1, -1, -2]],
  ["pergunta", "Com que frequência {voce} pergunta como os outros estão?", ["Raramente", "Às vezes", "Com frequência", "Todo dia"], [2, 1, -1, -2]],
  ["planta", "Cuidar de plantas ou de um bicho, para {voce}, é…", ["Trabalho demais", "Legal, se der pouco trabalho", "Um prazer", "Parte do dia"], [2, 1, -1, -2], "d"],
  ["receber", "Recebendo amigos em casa, {voce}…", ["Curte a festa também", "Deixa cada um se servir", "Serve todo mundo", "Não senta a noite toda, cuidando de tudo"], [2, 1, -1, -2]],
  ["ajuda", "Pedir ajuda, para {voce}, é…", ["Muito difícil", "Só em último caso", "Normal", "Natural: ajuda e pede ajuda sempre"], [2, 1, -1, -2]],
  ["datas", "Datas importantes dos outros, {voce}…", ["Esquece com frequência", "Lembra das principais", "Lembra de quase todas", "Lembra de todas e prepara algo"], [2, 1, -1, -2]],
  ["briga", "Quando duas pessoas queridas brigam, {voce}…", ["Não se mete", "Ouve os dois sem opinar", "Tenta aproximar", "Faz de tudo para reconciliar"], [2, 1, -1, -2]],
  ["morar", "Morar sem companhia, para {voce}, é…", ["O ideal", "Bom por um tempo", "Solitário", "Impensável"], [2, 1, -1, -2]],
  ["abrir-mao", "Abrir mão de um plano para ajudar alguém, {voce}…", ["Quase nunca", "Se for muito importante", "Com frequência", "Sempre, sem pensar"], [2, 1, -1, -2]],
  ["sucesso", "Sucesso, para {voce}, é…", ["Conquistar os próprios objetivos", "Ter liberdade", "Ter quem ama por perto", "Fazer bem para os outros"], [2, 1, -1, -2]],
  ["papel", "Num grupo, {voce} costuma ser quem…", ["Faz as coisas do próprio jeito", "Contribui e segue em frente", "Apoia quem está com dificuldade", "Cuida de todo mundo"], [2, 1, -1, -2]],
  ["desabafo", "Quando alguém desabafa com {voce}…", ["Sugere que resolva sem depender dos outros", "Dá uma solução prática", "Ouve com paciência", "Acolhe e liga no dia seguinte"], [2, 1, -1, -2]],
  ["cozinhar", "Cozinhar para os outros, para {voce}, é…", ["Trabalho", "Só em ocasiões especiais", "Um carinho", "A melhor forma de dizer que ama"], [2, 1, -1, -2], "d"],
  ["fam-ajuda", "Quando alguém da família precisa de ajuda, {voce}…", ["Ajuda se pedirem", "Oferece ajuda prática", "É dos primeiros a chegar", "Larga tudo para ajudar"], [2, 1, -1, -2], "familia"],
  ["fam-avos", "Com os mais velhos da família, {voce}…", ["Visita quando dá", "Liga de vez em quando", "Está sempre presente", "Cuida de perto"], [2, 1, -1, -2], "familia"],
  ["ami-fase", "Um amigo está numa fase difícil. O que {voce} faz?", ["Espera o amigo procurar", "Manda uma mensagem de apoio", "Chama para sair e distrair", "Aparece sem avisar para dar apoio"], [2, 1, -1, -2], "amigos"],
  ["ami-grupo", "No grupo de amigos, {voce} é quem…", ["Vive a própria vida", "Aparece quando pode", "Lembra dos aniversários", "Cuida de todo mundo"], [2, 1, -1, -2], "amigos"],
  ["cru-espaco", "Num relacionamento, {voce} precisa de…", ["Muito espaço próprio", "Algum espaço", "Estar sempre junto", "Cuidar e ser cuidado o tempo todo"], [2, 1, -1, -2], "crush"],
  ["cru-triste", "Quando o crush está triste, {voce}…", ["Dá espaço", "Manda mensagem", "Chama para conversar", "Aparece com um mimo"], [2, 1, -1, -2], "crush"],
]);

export const NUCLEO: PerguntaNucleo[] = [...SOCIAL, ...RITMO, ...DECISAO, ...REACAO, ...NOVIDADE, ...FOCO];

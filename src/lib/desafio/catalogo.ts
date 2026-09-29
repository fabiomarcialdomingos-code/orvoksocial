import { createHash } from "node:crypto";

/**
 * Perguntas do desafio sem cadastro. Vêm do catálogo de demonstração
 * (prisma/fixtures/radar-demo-catalog.json) enquanto o catálogo oficial não é
 * homologado. `terceira` é a mesma pergunta lida por quem tenta prever.
 */
export type PerguntaDesafio = {
  chave: string;
  texto: string;
  opcoes: [string, string, string, string];
  terceira: (nome: string) => string;
  opcoesTerceira: [string, string, string, string];
};

export const CODIGOS = ["A", "B", "C", "D"] as const;
export type CodigoOpcao = (typeof CODIGOS)[number];
export const CATALOGO_VERSAO = "ORVOK_DEMO_RADAR_V1:desafio-10";

export const PERGUNTAS: PerguntaDesafio[] = [
  { chave: "demo.decisao", texto: "Quando precisa tomar uma decisão importante, o que você faz primeiro?",
    opcoes: ["Listo prós e contras", "Sigo a intuição", "Converso com alguém de confiança", "Espero a poeira baixar"],
    terceira: (n) => `Quando precisa tomar uma decisão importante, o que ${n} faz primeiro?`,
    opcoesTerceira: ["Lista prós e contras", "Segue a intuição", "Conversa com alguém de confiança", "Espera a poeira baixar"] },
  { chave: "demo.sabado", texto: "Um sábado livre, sem compromissos. Como ele termina?",
    opcoes: ["Em casa, no meu ritmo", "Com amigos, fora de casa", "Resolvendo pendências", "Num lugar onde nunca fui"],
    terceira: (n) => `Um sábado livre, sem compromissos. Como termina o sábado de ${n}?`,
    opcoesTerceira: ["Em casa, no próprio ritmo", "Com amigos, fora de casa", "Resolvendo pendências", "Num lugar onde nunca foi"] },
  { chave: "demo.conflito", texto: "Alguém próximo te magoou sem perceber. Você…",
    opcoes: ["Fala na hora", "Espera esfriar e conversa", "Deixa passar", "Demonstra pelo comportamento"],
    terceira: (n) => `Alguém próximo magoou ${n} sem perceber. O que acontece?`,
    opcoesTerceira: ["Fala na hora", "Espera esfriar e conversa", "Deixa passar", "Demonstra pelo comportamento"] },
  { chave: "demo.dinheiro-extra", texto: "Entrou um dinheiro inesperado. Para onde ele vai?",
    opcoes: ["Reserva ou investimento", "Uma experiência marcante", "Algo que eu queria há tempos", "Dividir com quem eu gosto"],
    terceira: (n) => `Entrou um dinheiro inesperado para ${n}. Para onde ele vai?`,
    opcoesTerceira: ["Reserva ou investimento", "Uma experiência marcante", "Algo que queria há tempos", "Dividir com quem gosta"] },
  { chave: "demo.grupo", texto: "Num grupo novo de pessoas, você costuma…",
    opcoes: ["Puxar conversa", "Observar antes de falar", "Procurar alguém conhecido", "Ficar à vontade logo de cara"],
    terceira: (n) => `Num grupo novo de pessoas, ${n} costuma…`,
    opcoesTerceira: ["Puxar conversa", "Observar antes de falar", "Procurar alguém conhecido", "Ficar à vontade logo de cara"] },
  { chave: "demo.plano-b", texto: "O plano deu errado na última hora. Sua reação mais provável:",
    opcoes: ["Improviso na hora", "Fico irritado, depois resolvo", "Busco ajuda", "Aceito e mudo de assunto"],
    terceira: (n) => `O plano deu errado na última hora. A reação mais provável de ${n}:`,
    opcoesTerceira: ["Improvisa na hora", "Fica irritado, depois resolve", "Busca ajuda", "Aceita e muda de assunto"] },
  { chave: "demo.manha", texto: "Qual é a sua relação com as manhãs?",
    opcoes: ["Acordo cedo e bem", "Preciso de um tempo para engrenar", "Depende muito do dia", "Sou da noite, sem dúvida"],
    terceira: (n) => `Qual é a relação de ${n} com as manhãs?`,
    opcoesTerceira: ["Acorda cedo e bem", "Precisa de um tempo para engrenar", "Depende muito do dia", "É da noite, sem dúvida"] },
  { chave: "demo.elogio", texto: "Quando recebe um elogio em público, você…",
    opcoes: ["Agradece e segue", "Fica sem graça", "Devolve com outro elogio", "Desconversa com humor"],
    terceira: (n) => `Quando recebe um elogio em público, ${n}…`,
    opcoesTerceira: ["Agradece e segue", "Fica sem graça", "Devolve com outro elogio", "Desconversa com humor"] },
  { chave: "demo.viagem", texto: "Numa viagem, o que mais importa para você?",
    opcoes: ["Roteiro bem planejado", "Liberdade para mudar de ideia", "Boa companhia", "Comida local"],
    terceira: (n) => `Numa viagem, o que mais importa para ${n}?`,
    opcoesTerceira: ["Roteiro bem planejado", "Liberdade para mudar de ideia", "Boa companhia", "Comida local"] },
  { chave: "demo.aprender", texto: "Para aprender algo novo, você prefere…",
    opcoes: ["Ler e estudar sozinho", "Ver alguém fazendo", "Fazer e errar", "Ter aulas com alguém"],
    terceira: (n) => `Para aprender algo novo, ${n} prefere…`,
    opcoesTerceira: ["Ler e estudar sozinho", "Ver alguém fazendo", "Fazer e errar", "Ter aulas com alguém"] },
];

/** Aviso exibido antes do envio do convite. Mudou o texto, mude a versão. */
export const AVISO_VERSAO = "desafio-ser-previsto-v1";
export const AVISO_TEXTO =
  "Aceito ser previsto por quem abrir este convite. A pessoa tenta adivinhar as minhas respostas, mas nunca vê o que eu respondi. Posso cancelar o convite quando quiser.";
export const AVISO_HASH = createHash("sha256").update(`${AVISO_VERSAO}\n${AVISO_TEXTO}`).digest("hex");

export function perguntasPublicas() {
  return PERGUNTAS.map((p) => ({ chave: p.chave, texto: p.texto, opcoes: p.opcoes }));
}

export function perguntasTerceira(nome: string) {
  return PERGUNTAS.map((p) => ({ chave: p.chave, texto: p.terceira(nome), opcoes: p.opcoesTerceira }));
}

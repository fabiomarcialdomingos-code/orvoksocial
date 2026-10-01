/** Tipos e textos do Mundo entre pessoas, usados no app e na página do convidado. */
export type Opcao = { id: string; rotulo: string };
export type Rodada = {
  codigo: string; modo: "ser_previsto" | "prever";
  estado: "aguardando_convidado" | "aguardando_palpite" | "aguardando_revelacao" | "revelada" | "sem_comparacao" | "cancelada";
  lado: "criador" | "convidado";
  evento: { titulo: string; categoria: string; encerraEm: string; opcoes: Opcao[]; resultado: string | null };
  criador: string; convidado: string | null; quemResponde: string | null; quemAdivinha: string | null;
  minhaVez: boolean; minhaResposta: string | null; meuPalpite: string | null;
  revelacao: { resposta: string | null; palpite: string | null; naoSei: boolean; acertou: boolean } | null;
};
export const ROTULO_CATEGORIA: Record<string, string> = { economia: "Economia", tecnologia: "Tecnologia", esporte: "Esporte", entretenimento: "Entretenimento" };
export function quandoRevela(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
export function mensagemConvite(r: { modo: Rodada["modo"]; titulo: string }, url: string): string {
  return r.modo === "ser_previsto"
    ? `Respondi uma pergunta sobre "${r.titulo}". Você consegue adivinhar o que eu respondi? ${url}`
    : `Quero ver se consigo adivinhar sua opinião sobre "${r.titulo}". Responde aqui, é rápido: ${url}`;
}
/** Frase de estado, do ponto de vista de quem está vendo. */
export function fraseEstado(r: Rodada): string {
  const outro = r.lado === "criador" ? (r.convidado ?? "A pessoa convidada") : r.criador;
  switch (r.estado) {
    case "aguardando_convidado": return r.lado === "criador" ? `Aguardando ${r.convidado ?? "a pessoa"} abrir o convite` : "Sua vez de responder";
    case "aguardando_palpite": return r.lado === "criador" ? `${outro} respondeu. Agora é a sua vez de adivinhar` : `${outro} vai tentar adivinhar a sua resposta`;
    case "aguardando_revelacao": return `Tudo registrado. Revelação ${quandoRevela(r.evento.encerraEm)}`;
    case "revelada": return r.revelacao?.naoSei ? `${r.quemAdivinha} preferiu não arriscar` : r.revelacao?.acertou ? `${r.quemAdivinha} acertou o que ${r.quemResponde} respondeu` : `${r.quemAdivinha} não previu ${r.quemResponde} desta vez`;
    case "sem_comparacao": return "O evento terminou antes de os dois responderem. Não conta para ninguém.";
    case "cancelada": return "O evento foi cancelado. A rodada não conta como acerto nem erro.";
  }
}

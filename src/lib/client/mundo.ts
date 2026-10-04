/** Tipos e textos do Mundo entre pessoas, usados no app e na página do convidado. */
export type Opcao = { id: string; rotulo: string };
export type Rodada = {
  codigo: string; modo: "ser_previsto" | "prever";
  estado: "aguardando_convidado" | "aguardando_criador" | "aguardando_revelacao" | "revelada" | "sem_comparacao" | "cancelada";
  lado: "criador" | "convidado";
  evento: { titulo: string; categoria: string; encerraEm: string; opcoes: Opcao[]; resultado: string | null };
  criador: string; convidado: string | null; primeiro: string | null; segundo: string | null;
  minhaVez: boolean; minhaOpiniao: string | null;
  revelacao: { primeiraOpiniao: string | null; segundaOpiniao: string | null; semOpiniao: boolean; igual: boolean } | null;
};
export const ROTULO_CATEGORIA: Record<string, string> = { economia: "Economia", tecnologia: "Tecnologia", esporte: "Esporte", entretenimento: "Entretenimento" };
export function quandoRevela(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
export function mensagemConvite(r: { modo: Rodada["modo"]; titulo: string }, url: string): string {
  return r.modo === "ser_previsto"
    ? `Já compartilhei o que acho sobre "${r.titulo}". Quando o evento terminar, vamos ver se pensamos igual. Compartilhe a sua opinião aqui: ${url}`
    : `Gostaria de saber o que você acha sobre "${r.titulo}". Responda aqui e, quando o evento terminar, vemos se pensamos igual: ${url}`;
}
/** Frase de estado, do ponto de vista de quem está vendo. */
export function fraseEstado(r: Rodada): string {
  const outra = r.lado === "criador" ? (r.convidado ?? "a pessoa convidada") : r.criador;
  switch (r.estado) {
    case "aguardando_convidado": return r.lado === "criador" ? `Aguardando ${outra} compartilhar a opinião` : "Sua vez de responder";
    case "aguardando_criador": return r.lado === "criador" ? `${outra} já respondeu. Agora é a sua vez` : `${outra} vai responder em seguida`;
    case "aguardando_revelacao": return `Tudo registrado. Revelação ${quandoRevela(r.evento.encerraEm)}`;
    case "revelada": return r.revelacao?.semOpiniao ? `${r.segundo} preferiu não opinar` : r.revelacao?.igual ? "Vocês pensaram igual" : "Vocês pensaram diferente";
    case "sem_comparacao": return "O evento terminou antes de as duas opiniões chegarem. Esta conversa não entra na conta.";
    case "cancelada": return "O evento foi cancelado. Esta conversa não entra na conta.";
  }
}

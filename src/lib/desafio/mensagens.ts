import type { Relacao } from "./nucleo";

export type Tom = 0 | 1 | 2;
export const ROTULOS_TOM = ["Curioso", "Carinhoso", "Direto"] as const;

const com = (a: string, comNome: string, semNome: string) => (a ? `${a}, ${comNome}` : semNome);

/**
 * A mensagem que a pessoa manda junto com o link, por relação e tom. Em "alguém especial" nenhum texto cita a palavra
 * "crush" nem a relação: quem recebe não deve se sentir classificado (o convite é igual para qualquer pessoa).
 */
export function mensagemConvite(relacao: Relacao, tom: number, destinatario: string): string {
  const a = destinatario.trim();
  const t = (tom === 1 ? 1 : tom === 2 ? 2 : 0) as Tom;
  const tabela: Record<Relacao, [string, string, string]> = {
    familia: [
      `${com(a, "queria", "Queria")} saber como você me enxerga. São 12 perguntas no orvok, rápidas e anônimas:`,
      `${com(a, "você", "Você")} me conhece desde sempre. Me conta como a família me vê? Leva 3 minutos e é anônimo:`,
      "Pode me dizer como você me vê? São 12 perguntas no orvok, leva cerca de 3 minutos e é anônimo:",
    ],
    amigos: [
      `${com(a, "gostaria", "Gostaria")} de saber como você me vê de verdade. São 12 perguntas no orvok, anônimas:`,
      `${com(a, "sua", "Sua")} visão importa para mim. Poderia me contar como você me enxerga? É anônimo:`,
      "Poderia compartilhar como você me vê? São 12 perguntas no orvok, leva cerca de 3 minutos e é anônimo:",
    ],
    crush: [
      `${com(a, "fiz", "Fiz")} um teste curioso e queria saber como você me enxerga. Leva 3 minutos e é anônimo:`,
      `${com(a, "sua", "Sua")} opinião importa para mim. Pode me contar como você me vê? É anônimo:`,
      "Pode compartilhar como você me vê? São 12 perguntas no orvok, leva cerca de 3 minutos e é anônimo:",
    ],
  };
  return tabela[relacao][t];
}

export type CanalWeb = "whatsapp" | "facebook";

/** Endereços de compartilhamento que funcionam pela web (sem aplicativo nativo). */
export function urlCompartilhar(canal: CanalWeb, link: string, texto: string): string {
  if (canal === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(`${texto} ${link}`)}`;
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
}

/** Os passos para colocar o convite nos Stories do Instagram: não existe atalho oficial pela web. */
export const PASSOS_STORIES = [
  "Baixe o card vertical (o botão abaixo também copia o link do convite).",
  "No Instagram, abra Stories e escolha o card na sua galeria.",
  "Toque no adesivo de link, cole o link copiado e publique.",
] as const;

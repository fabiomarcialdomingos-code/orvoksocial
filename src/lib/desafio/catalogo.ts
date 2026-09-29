import { createHash } from "node:crypto";
import type { PerguntaBanco } from "./banco";
import { textoPara } from "./selecao";

export const CODIGOS = ["A", "B", "C", "D"] as const;
export type CodigoOpcao = (typeof CODIGOS)[number];
export const CATALOGO_VERSAO = "ORVOK_DESAFIO_BANCO_V1";

/** Aviso exibido antes do envio do convite. Mudou o texto, mude a versão. */
export const AVISO_VERSAO = "desafio-ser-previsto-v1";
export const AVISO_TEXTO =
  "Aceito ser previsto por quem abrir este convite. A pessoa tenta adivinhar as minhas respostas, mas nunca vê o que eu respondi. Posso cancelar o convite quando quiser.";
export const AVISO_HASH = createHash("sha256").update(`${AVISO_VERSAO}\n${AVISO_TEXTO}`).digest("hex");
export const AVISO = { versao: AVISO_VERSAO, hash: AVISO_HASH, texto: AVISO_TEXTO };

/** Formato enviado ao navegador. `quem` null: pergunta para quem responde sobre si. */
export function perguntaPublica(p: PerguntaBanco, quem: string | null = null) {
  return { chave: p.chave, texto: textoPara(p, quem), opcoes: p.opcoes };
}

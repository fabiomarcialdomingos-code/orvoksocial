import { createHash } from "node:crypto";
import { textoPara } from "./selecao";

export const CODIGOS = ["A", "B", "C", "D"] as const;
export const CATALOGO_VERSAO = "ORVOK_DESAFIO_NUCLEO_V1";

/** Aviso exibido antes do envio do convite. Mudou o texto, mude a versão. */
export const AVISO_VERSAO = "desafio-convite-v3";
export const AVISO_TEXTO =
  "Aceito que quem abrir este convite responda sobre mim. A pessoa nunca vê o que eu respondi. Posso cancelar o convite quando quiser. Confirmo ter pelo menos 16 anos e aceito os Termos de uso e a Política de privacidade.";
export const AVISO_HASH = createHash("sha256").update(`${AVISO_VERSAO}\n${AVISO_TEXTO}`).digest("hex");
export const AVISO = { versao: AVISO_VERSAO, hash: AVISO_HASH, texto: AVISO_TEXTO };

/** Aviso exibido a quem aceita prever alguém, antes de ver as perguntas. */
export const AVISO_IDADE_VERSAO = "desafio-aceitar-idade-v1";
export const AVISO_IDADE_TEXTO = "Confirmo ter pelo menos 16 anos e aceito os Termos de uso e a Política de privacidade.";
export const AVISO_IDADE_HASH = createHash("sha256").update(`${AVISO_IDADE_VERSAO}\n${AVISO_IDADE_TEXTO}`).digest("hex");
export const AVISO_IDADE = { versao: AVISO_IDADE_VERSAO, hash: AVISO_IDADE_HASH, texto: AVISO_IDADE_TEXTO };

/** Formato enviado ao navegador. `quem` null: pergunta para quem responde sobre si. */
export function perguntaPublica(p: { chave: string; texto: string; opcoes: [string, string, string, string] }, quem: string | null = null) {
  return { chave: p.chave, texto: textoPara(p, quem), opcoes: p.opcoes };
}

/** Versão do aviso de anonimato de quem responde sobre alguém (o texto fica na tela de resposta). */
export const AVISO_RETRATO_VERSAO = "retrato-opiniao-v1";
/** Mínimo de pessoas por pergunta para ela aparecer no retrato. */
export const MINIMO_RETRATO = 3;

import { ImageResponse } from "next/og";
import { CartaoConvite, TAMANHO_CARTAO, fontesCartao, type FormatoCartao } from "./cartao";

/** Desenha o card em PNG. É a parte lenta (2 a 4 s); por isso ela só roda uma vez por convite e o resultado é guardado. */
export async function gerarCartao(nome: string | null, relacao: string | null, formato: FormatoCartao): Promise<Buffer> {
  const r = new ImageResponse(<CartaoConvite nome={nome} relacao={relacao} formato={formato} />, { ...TAMANHO_CARTAO[formato], fonts: await fontesCartao() });
  return Buffer.from(await r.arrayBuffer());
}

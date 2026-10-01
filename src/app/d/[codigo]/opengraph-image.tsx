import { ImageResponse } from "next/og";
import { authPool } from "@/lib/auth/session";
import { CartaoConvite, fontesCartao } from "@/lib/desafio/cartao";
import { DesafioService } from "@/lib/desafio/service";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Convite do orvok";

/** Prévia do link do convite no WhatsApp: nome de quem convidou e o tipo, nunca respostas. */
export default async function Image({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const v = await new DesafioService(authPool()).vitrine(codigo.toUpperCase(), null).catch(() => null);
  return new ImageResponse(<CartaoConvite nome={v?.nome ?? null} tipo={v?.tipo ?? null} />, { ...size, fonts: await fontesCartao() });
}

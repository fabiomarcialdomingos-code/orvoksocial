import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { FluxoResponder } from "@/components/desafio/FluxoResponder";
import { authPool } from "@/lib/auth/session";
import { DesafioService } from "@/lib/desafio/service";

/** Título e descrição do link no WhatsApp, com o nome de quem convidou. */
export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  const { codigo } = await params;
  const v = await new DesafioService(authPool()).vitrine(codigo.toUpperCase(), null).catch(() => null);
  const titulo = !v ? "Convite do orvok" : `Como você vê ${v.nome}?`;
  const descricao = !v ? "Descubra como as pessoas que importam te enxergam."
    : `${v.nome} convidou você para compartilhar a sua visão. Leva cerca de 3 minutos e é anônimo.`;
  return { title: titulo, description: descricao, robots: { index: false }, openGraph: { title: titulo, description: descricao } };
}

export default async function Page({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <FluxoResponder codigo={codigo.toUpperCase()} />;
}

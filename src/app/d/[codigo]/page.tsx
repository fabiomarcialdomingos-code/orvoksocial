import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { FluxoPrever } from "@/components/desafio/FluxoPrever";
import { authPool } from "@/lib/auth/session";
import { DesafioService } from "@/lib/desafio/service";

/** Título e descrição do link no WhatsApp, com o nome de quem convidou. */
export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  const { codigo } = await params;
  const v = await new DesafioService(authPool()).vitrine(codigo.toUpperCase(), null).catch(() => null);
  const titulo = !v ? "Convite do orvok" : v.tipo === "retrato" ? `Como você vê ${v.nome}?` : `${v.nome} te desafiou no orvok`;
  const descricao = !v ? "Descubra quem conhece você de verdade."
    : v.tipo === "retrato" ? `${v.nome} quer saber como você enxerga essa pessoa. 3 minutos, anônimo.` : "Quanto você conhece essa pessoa? 5 perguntas, 1 minuto.";
  return { title: titulo, description: descricao, robots: { index: false }, openGraph: { title: titulo, description: descricao } };
}

export default async function Page({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <FluxoPrever codigo={codigo.toUpperCase()} />;
}

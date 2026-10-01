import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { FluxoRodada } from "@/components/desafio/FluxoRodada";
import { AVISO_IDADE_HASH } from "@/lib/desafio/catalogo";

export const metadata: Metadata = { title: "Uma rodada para você no orvok", description: "Alguém quer saber se você consegue adivinhar uma resposta. Leva 20 segundos.", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <FluxoRodada codigo={codigo.toUpperCase()} hashIdade={AVISO_IDADE_HASH} />;
}

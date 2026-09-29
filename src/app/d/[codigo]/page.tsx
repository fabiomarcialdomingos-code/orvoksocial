import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { FluxoPrever } from "@/components/desafio/FluxoPrever";

export const metadata: Metadata = { title: "Você foi desafiado", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <FluxoPrever codigo={codigo.toUpperCase()} />;
}

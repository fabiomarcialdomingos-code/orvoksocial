import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { FluxoCriar } from "@/components/desafio/FluxoCriar";

export const metadata: Metadata = { title: "Quanto seus amigos te conhecem?" };

export default async function Page({ searchParams }: { searchParams: Promise<{ volta?: string }> }) {
  const { volta } = await searchParams;
  const nome = typeof volta === "string" ? volta.trim().slice(0, 24) : "";
  return <FluxoCriar desafiarDeVolta={nome.length >= 2 ? nome : null} />;
}

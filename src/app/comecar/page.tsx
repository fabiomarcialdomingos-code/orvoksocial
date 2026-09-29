import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { FluxoCriar } from "@/components/desafio/FluxoCriar";

export const metadata: Metadata = { title: "Quanto seus amigos te conhecem?" };

export default async function Page({ searchParams }: { searchParams: Promise<{ volta?: string; de?: string; rel?: string }> }) {
  const { volta, de, rel } = await searchParams;
  const nome = typeof volta === "string" ? volta.trim().slice(0, 24) : "";
  const codigo = typeof de === "string" && /^[A-Za-z0-9]{8}$/.test(de) ? de.toUpperCase() : null;
  return <FluxoCriar desafiarDeVolta={nome.length >= 2 ? nome : null} conjuntoDe={nome.length >= 2 ? codigo : null} relacaoInicial={rel === "familia" || rel === "amigos" || rel === "crush" ? rel : null} />;
}

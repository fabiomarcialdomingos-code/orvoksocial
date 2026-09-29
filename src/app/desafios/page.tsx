import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { DesafiosPagina } from "@/components/rede/DesafiosPagina";

export const metadata: Metadata = { title: "Meus desafios", robots: { index: false } };

export default function Page() {
  return <DesafiosPagina />;
}

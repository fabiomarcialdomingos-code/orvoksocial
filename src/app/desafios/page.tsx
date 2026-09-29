import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { MeusDesafios } from "@/components/desafio/MeusDesafios";

export const metadata: Metadata = { title: "Meus desafios", robots: { index: false } };

export default function Page() {
  return <MeusDesafios />;
}

import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { Mandar } from "@/components/estante/Mandar";
import { exigirEstanteAtiva } from "@/lib/estante/pagina";

export const metadata: Metadata = { title: "Lembrei de você", robots: { index: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ para?: string }> }) {
  await exigirEstanteAtiva();
  const { para } = await searchParams;
  return <Mandar para={para && /^[0-9a-f-]{36}$/i.test(para) ? para : null} />;
}

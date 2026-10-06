import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { Estante } from "@/components/estante/Estante";
import { exigirEstanteAtiva } from "@/lib/estante/pagina";

export const metadata: Metadata = { title: "A sua estante", robots: { index: false } };
export default async function Page() { await exigirEstanteAtiva(); return <Estante />; }

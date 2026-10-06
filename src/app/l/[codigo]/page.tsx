import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { Presente } from "@/components/estante/Recebendo";
import { exigirEstanteAtiva } from "@/lib/estante/pagina";

export const metadata: Metadata = { title: "Alguém lembrou de você", description: "Uma lembrança guardada para você no orvok.", robots: { index: false } };
export default async function Page({ params }: { params: Promise<{ codigo: string }> }) { await exigirEstanteAtiva(); const { codigo } = await params; return <Presente codigo={codigo.toUpperCase()} />; }

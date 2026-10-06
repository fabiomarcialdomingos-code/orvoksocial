import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { EstanteDe } from "@/components/estante/Recebendo";
import { exigirEstanteAtiva } from "@/lib/estante/pagina";

export const metadata: Metadata = { title: "Estante", robots: { index: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { await exigirEstanteAtiva(); const { id } = await params; return <EstanteDe id={id} />; }

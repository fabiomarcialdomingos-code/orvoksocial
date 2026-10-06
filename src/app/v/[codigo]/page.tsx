import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { ConviteCirculo } from "@/components/estante/Recebendo";
import { exigirEstanteAtiva } from "@/lib/estante/pagina";

export const metadata: Metadata = { title: "Convite para o círculo", robots: { index: false } };
export default async function Page({ params }: { params: Promise<{ codigo: string }> }) { await exigirEstanteAtiva(); const { codigo } = await params; return <ConviteCirculo codigo={codigo.toUpperCase()} />; }

import "@fontsource-variable/onest";
import type { Metadata } from "next";
import { FluxoResponder } from "@/components/desafio/FluxoResponder";
import { authPool } from "@/lib/auth/session";
import { versaoDoCartao } from "@/lib/desafio/cartao-armazem";
import { DesafioService } from "@/lib/desafio/service";

/** Título e descrição do link no WhatsApp, com o nome de quem convidou. */
export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  const { codigo } = await params;
  // Consulta pública: não conta como "convite aberto" (antes, cada leitura do título contava).
  const v = await new DesafioService(authPool()).resumoPublico(codigo.toUpperCase()).catch(() => null);
  const base = process.env.APP_ORIGIN ?? "https://orvok.com.br";
  const titulo = !v ? "Convite do orvok" : `Como você vê ${v.nome}?`;
  const descricao = !v ? "Descubra como as pessoas que importam te enxergam."
    : `${v.nome} escolheu você para contar como te enxerga. São 12 perguntas, leva cerca de 3 minutos e é anônimo.`;
  const imagem = `${base}/d/${codigo.toUpperCase()}/cartao${v ? `?v=${versaoDoCartao(v.nome, v.relacao)}` : ""}`;
  return {
    title: titulo, description: descricao, robots: { index: false },
    openGraph: { title: titulo, description: descricao, url: `${base}/d/${codigo.toUpperCase()}`, siteName: "orvok", locale: "pt_BR", type: "website",
      images: [{ url: imagem, width: 1200, height: 630, type: "image/png", alt: v ? `Convite de ${v.nome} no orvok` : "Convite do orvok" }] },
    twitter: { card: "summary_large_image", title: titulo, description: descricao, images: [imagem] },
  };
}

export default async function Page({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <FluxoResponder codigo={codigo.toUpperCase()} />;
}

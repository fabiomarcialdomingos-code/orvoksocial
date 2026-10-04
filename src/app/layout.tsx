import type { Metadata, Viewport } from "next";
import "@fontsource-variable/onest";
import "./globals.css";
import { RegistrarApp } from "../components/RegistrarApp";
import { Spotlight } from "../components/ui/Spotlight";
import { MetaPixel } from "../components/MetaPixel";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icone-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "orvok", statusBarStyle: "black-translucent" },
  title: { default: "orvok", template: "%s · orvok" },
  description: "Veja-se pelos olhos de quem te conhece, e preveja o mundo junto com eles.",
};

export const viewport: Viewport = { themeColor: "#040811", colorScheme: "dark", viewportFit: "cover" };

/**
 * O CSP (middleware.ts) só libera scripts inline com um nonce novo a cada
 * requisição, e o Next.js só consegue colocar esse nonce nos scripts do próprio
 * Next quando a página é montada na hora do acesso. Páginas pré-geradas no
 * build (como /entrar, /cadastro, /painel) saem sem nonce: o navegador bloqueia
 * o script de hidratação, a página nunca "acorda" e os formulários viram envios
 * nativos do navegador (a senha vai parar na URL). Por isso tudo é dinâmico.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
        {children}
        <RegistrarApp />
        <Spotlight />
        <MetaPixel />
      </body>
    </html>
  );
}

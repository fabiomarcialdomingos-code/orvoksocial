import type { Metadata, Viewport } from "next";
import "@fontsource-variable/onest";
import "./globals.css";
import { RegistrarApp } from "../components/RegistrarApp";
import { Spotlight } from "../components/ui/Spotlight";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icone-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "orvok", statusBarStyle: "black-translucent" },
  title: { default: "orvok", template: "%s · orvok" },
  description: "Veja-se pelos olhos de quem te conhece, e preveja o mundo junto com eles.",
};

export const viewport: Viewport = { themeColor: "#040811", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
        {children}
        <RegistrarApp />
        <Spotlight />
      </body>
    </html>
  );
}

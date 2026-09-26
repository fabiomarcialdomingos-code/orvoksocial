import type { Metadata, Viewport } from "next";
import "@fontsource/bodoni-moda/400-italic.css";
import "@fontsource/bodoni-moda/500.css";
import "@fontsource/bodoni-moda/500-italic.css";
import "@fontsource/bodoni-moda/600.css";
import "@fontsource/bodoni-moda/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./globals.css";
import { Spotlight } from "../components/ui/Spotlight";

export const metadata: Metadata = {
  title: { default: "ORVOK", template: "%s · ORVOK" },
  description: "Veja-se pelos olhos de quem te conhece, e preveja o mundo junto com eles.",
};

export const viewport: Viewport = { themeColor: "#0e0f12", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
        {children}
        <Spotlight />
      </body>
    </html>
  );
}

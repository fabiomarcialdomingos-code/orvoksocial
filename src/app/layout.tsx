import type { Metadata, Viewport } from "next";
import "@fontsource-variable/onest";
import "./globals.css";
import { Spotlight } from "../components/ui/Spotlight";

export const metadata: Metadata = {
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
        <Spotlight />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "./globals.css";


export const metadata: Metadata = {
  title: { default: "ORVOK", template: "%s · ORVOK" },
  description: "Veja-se pelos olhos de quem te conhece, e preveja o mundo junto com eles.",
};

export const viewport: Viewport = { themeColor: "#f7f6f2", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
        {children}

      </body>
    </html>
  );
}

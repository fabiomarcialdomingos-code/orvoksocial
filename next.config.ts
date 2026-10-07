import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A imagem de prévia do convite lê as fontes do disco: garante que entrem no pacote da função.
  outputFileTracingIncludes: { "/d/[codigo]/opengraph-image": ["./src/lib/desafio/fonts/**"] },
  // Accept the loopback host used when accessing the local development server.
  allowedDevOrigins: ["127.0.0.1"],
  // A página inicial é a rede em HTML estático (public/inicio.html).
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/inicio.html" }], afterFiles: [], fallback: [] };
  },
  // O endereço antigo da Vercel passa a levar ao domínio próprio, preservando caminho e parâmetros: os links de
  // convite já compartilhados com o endereço antigo continuam funcionando.
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host" as const, value: "orvoksocial.vercel.app" }], destination: "https://orvok.com.br/:path*", permanent: true }];
  },
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // Content-Security-Policy não entra aqui: precisa de um nonce por requisição
      // (liberar os scripts inline que o próprio Next.js injeta para hidratar), e
      // headers() só gera um valor estático. Ver middleware.ts.
    ];
    if (process.env.APP_ENV === "production")
      common.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    return [
      { source: "/:path*", headers: common },
      { source: "/verificar-email", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/nova-senha", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;

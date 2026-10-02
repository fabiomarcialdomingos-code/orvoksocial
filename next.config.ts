import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Accept the loopback host used when accessing the local development server.
  allowedDevOrigins: ["127.0.0.1"],
  // A página inicial é a rede em HTML estático (public/inicio.html).
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/inicio.html" }], afterFiles: [], fallback: [] };
  },
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // script-src/connect-src/img-src abrem exceção só para o Meta Pixel (connect.facebook.net
      // carrega o script, www.facebook.com recebe os eventos e serve o fallback <img> do noscript).
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' https://connect.facebook.net; connect-src 'self' https://www.facebook.com; img-src 'self' https://www.facebook.com; style-src 'self' 'unsafe-inline'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'" },
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

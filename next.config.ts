import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Playwright exercises the local server through the explicit loopback host.
  // Allow that development origin so Next's HMR/client boundary does not
  // suppress hydration during authenticated E2E runs.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'" },
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

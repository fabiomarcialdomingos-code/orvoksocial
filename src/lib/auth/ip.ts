/**
 * Origem da requisição, para limites por IP. Na Vercel, x-forwarded-for e x-real-ip são escritos pela própria
 * plataforma (quem chama não consegue forjar). Fora dela (desenvolvimento) o cabeçalho vem de quem chama.
 */
export function clientIp(request: Request): string | null {
  const real = request.headers.get("x-real-ip")?.trim();
  const encaminhado = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = real || encaminhado || null;
  return ip && ip.length <= 64 ? ip : null;
}

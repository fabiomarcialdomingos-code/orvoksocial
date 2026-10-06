import { NextRequest, NextResponse } from "next/server";

/**
 * Gera um nonce por requisição para liberar os scripts inline que o próprio
 * Next.js injeta (payload do RSC, bootstrap de hidratação). Sem isso, o CSP
 * de script-src 'self' bloqueia esses scripts inline silenciosamente: a
 * página renderiza no servidor mas nunca hidrata, e nenhum clique funciona
 * (sem erro visível além de "Minified React error #412 / Connection closed"
 * no console, já que o bloqueio do CSP não passa por try/catch).
 *
 * Imagens embutidas (data:) e a prévia de uma foto escolhida no próprio aparelho (blob:) são liberadas só em img-src: o grão do fundo e o
 * ícone da home usam isso, e uma imagem SVG carregada assim nunca executa script.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://connect.facebook.net; connect-src 'self' https://www.facebook.com; img-src 'self' data: blob: https://www.facebook.com; style-src 'self' 'unsafe-inline'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'`;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Roda em tudo, exceto assets estáticos (sem necessidade de CSP/nonce ali).
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

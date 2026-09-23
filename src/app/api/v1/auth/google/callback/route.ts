import { googleCallback } from "@/lib/auth/google";
import { AuthService } from "@/lib/auth/service";
import { authPool, setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const result = await googleCallback(request);
    const session = await new AuthService(authPool()).loginWithGoogle(result.claims);
    const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
    const redirect = new URL(result.returnTo, origin);
    const response = new Response(null, { status: 302, headers: { Location: redirect.toString() } });
    setSessionCookie(response, session.token);
    result.clear(response);
    return response;
  } catch {
    return new Response(null, { status: 302, headers: { Location: new URL("/entrar?oauth=error", process.env.APP_ORIGIN ?? new URL(request.url).origin).toString() } });
  }
}

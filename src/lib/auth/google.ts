import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AuthError } from "./session";

const COOKIE = "orvok_google_oauth";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const authSecret = process.env.AUTH_SECRET;
  if (!clientId || !secret || !redirectUri || !authSecret || authSecret.length < 32) throw new AuthError("GOOGLE_NOT_CONFIGURED", 503);
  return { clientId, secret, redirectUri, authSecret };
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function cookieHeader(value: string, maxAge: number): string {
  const secure = process.env.APP_ENV === "production" ? "; Secure" : "";
  return COOKIE + "=" + value + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + maxAge + secure;
}

export function googleStartResponse(returnTo = "/radar"): Response {
  const { clientId, redirectUri, authSecret } = config();
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/radar";
  const context = { state: randomBytes(24).toString("base64url"), nonce: randomBytes(24).toString("base64url"), returnTo: safeReturn, exp: Date.now() + 10 * 60_000 };
  const payload = Buffer.from(JSON.stringify(context)).toString("base64url");
  const value = payload + "." + sign(payload, authSecret);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", context.state);
  url.searchParams.set("nonce", context.nonce);
  const response = new Response(null, { status: 302, headers: { Location: url.toString() } });
  response.headers.append("Set-Cookie", cookieHeader(value, 600));
  return response;
}

function readCookie(request: Request): string | null {
  const raw = request.headers.get("cookie") ?? "";
  const prefix = COOKIE + "=";
  return raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function clearCookie(response: Response): void { response.headers.append("Set-Cookie", cookieHeader("", 0)); }

function verifiedEqual(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function googleCallback(request: Request): Promise<{ claims: { subject: string; email: string; emailVerified: boolean }; returnTo: string; clear: (response: Response) => void }> {
  const { clientId, secret, redirectUri, authSecret } = config();
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) throw new AuthError(error === "access_denied" ? "GOOGLE_CANCELLED" : "GOOGLE_AUTH_FAILED", 400);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stored = readCookie(request);
  if (!code || !state || !stored) throw new AuthError("GOOGLE_CALLBACK_INVALID", 400);
  const parts = stored.split(".");
  const payload = parts[0]; const signature = parts[1];
  if (!payload || !signature || !verifiedEqual(signature, sign(payload, authSecret))) throw new AuthError("GOOGLE_CALLBACK_INVALID", 400);
  const context = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { state: string; nonce: string; returnTo: string; exp: number };
  if (context.exp < Date.now() || !verifiedEqual(context.state, state)) throw new AuthError("GOOGLE_CALLBACK_REPLAY", 400);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: secret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
  if (!tokenResponse.ok) throw new AuthError("GOOGLE_TOKEN_EXCHANGE_FAILED", 400);
  const token = await tokenResponse.json() as { id_token?: string };
  if (!token.id_token) throw new AuthError("GOOGLE_ID_TOKEN_MISSING", 400);
  const tokenInfoResponse = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token.id_token));
  if (!tokenInfoResponse.ok) throw new AuthError("GOOGLE_ID_TOKEN_INVALID", 400);
  const info = await tokenInfoResponse.json() as { iss?: string; aud?: string; sub?: string; email?: string; email_verified?: string | boolean; nonce?: string; exp?: string };
  if (!info.iss || !ISSUERS.has(info.iss) || info.aud !== clientId || !info.sub || !info.email || String(info.email_verified) !== "true" || info.nonce !== context.nonce || !info.exp || Number(info.exp) * 1000 < Date.now()) throw new AuthError("GOOGLE_ID_TOKEN_INVALID", 400);
  return { claims: { subject: info.sub, email: info.email, emailVerified: true }, returnTo: context.returnTo, clear: clearCookie };
}

import { Pool } from "pg";
import { tokenHash } from "./crypto";
import { assertRuntimeDatabaseBoundary } from "../runtime-boundary";

export type AuthPrincipal = {
  userId: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  sessionId: string;
};

export class AuthError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = "AuthError";
  }
}

const globalPool = globalThis as typeof globalThis & { __orvokAuthPool?: Pool };
export function authPool(): Pool {
  assertRuntimeDatabaseBoundary();
  if (!globalPool.__orvokAuthPool) {
    if (!process.env.AUTH_DATABASE_URL) throw new Error("AUTH_DATABASE_URL is required");
    globalPool.__orvokAuthPool = new Pool({
      connectionString: process.env.AUTH_DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 3000,
    });
  }
  return globalPool.__orvokAuthPool;
}

export function cookieName(): string {
  return process.env.APP_ENV === "production" ? "__Host-orvok_session" : "orvok_session";
}

export function readSessionCookie(request: Request): string | null {
  const value = request.headers.get("cookie") ?? "";
  for (const part of value.split(";")) {
    const [name, token] = part.trim().split("=");
    if (name === cookieName() && token && /^[A-Za-z0-9_-]{43}$/.test(token)) return token;
  }
  return null;
}

export function setSessionCookie(response: Response, token: string): void {
  const secure = process.env.APP_ENV === "production" || process.env.APP_ORIGIN?.startsWith("https://") ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${cookieName()}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`,
  );
}

export function clearSessionCookie(response: Response): void {
  const secure = process.env.APP_ENV === "production" || process.env.APP_ORIGIN?.startsWith("https://") ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${cookieName()}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`,
  );
}

export function assertMutationRequest(request: Request): void {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new AuthError("JSON_REQUIRED", 415);
  const origin = request.headers.get("origin");
  if (process.env.APP_ENV === "production" && !process.env.APP_ORIGIN)
    throw new AuthError("ORIGIN_NOT_CONFIGURED", 500);
  const expected = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  if (!origin || origin !== expected) throw new AuthError("ORIGIN_REJECTED", 403);
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none")
    throw new AuthError("CROSS_SITE_REJECTED", 403);
}

export async function requirePrincipal(request: Request): Promise<AuthPrincipal> {
  const token = readSessionCookie(request);
  if (!token) throw new AuthError("UNAUTHENTICATED", 401);
  const found = await authPool().query<{
    id: string;
    userId: string;
    role: AuthPrincipal["role"];
  }>(
    `SELECT s.id,s."userId",u.role FROM "AuthSession" s JOIN "User" u ON u.id=s."userId"
     JOIN "AuthIdentity" ai ON ai."userId"=u.id
     WHERE s."tokenHash"=$1 AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp()
     AND u.status='ACTIVE' AND ai."verifiedAt" IS NOT NULL`,
    [tokenHash(token)],
  );
  const row = found.rows[0];
  if (!row) throw new AuthError("UNAUTHENTICATED", 401);
  return { userId: row.userId, role: row.role, sessionId: row.id };
}

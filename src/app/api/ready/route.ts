import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { ok: boolean; hint?: string };

/**
 * Readiness with a configuration diagnosis. Answers only booleans and fixed
 * hints: no secret, host name, URL or personal data is ever returned.
 */
export async function GET(request: Request) {
  const env = process.env;
  const deployed = env.APP_ENV === "staging" || env.APP_ENV === "production";
  const checks: Record<string, Check> = {};
  const origin = new URL(request.url).origin;

  checks.appEnv = { ok: Boolean(env.APP_ENV), hint: "Defina APP_ENV (production em produção)." };
  checks.appOrigin = {
    ok: !deployed || env.APP_ORIGIN === origin || env.APP_ORIGIN === request.headers.get("x-forwarded-proto") + "://" + request.headers.get("host"),
    hint: "APP_ORIGIN precisa ser exatamente o endereço público do site, com https e sem barra no final.",
  };
  checks.noOwnerCredential = {
    ok: !deployed || (!env.DATABASE_URL && !env.DB_OWNER_URL),
    hint: "Em produção, DATABASE_URL e DB_OWNER_URL não podem existir no serviço web (use APP_DATABASE_URL e AUTH_DATABASE_URL).",
  };
  checks.runtimeCredentials = {
    ok: Boolean(env.APP_DATABASE_URL && env.AUTH_DATABASE_URL),
    hint: "Cadastre APP_DATABASE_URL e AUTH_DATABASE_URL (geradas pelo provisionamento).",
  };
  checks.authSecret = { ok: Boolean(env.AUTH_SECRET && env.AUTH_SECRET.length >= 32), hint: "Defina AUTH_SECRET com pelo menos 32 caracteres." };
  checks.authMailKey = { ok: Boolean(env.AUTH_MAIL_KEY), hint: "Defina AUTH_MAIL_KEY." };
  checks.appUrl = { ok: Boolean(env.APP_URL), hint: "Defina APP_URL com o domínio público (usado nos cartões de convite)." };

  if (env.AUTH_DATABASE_URL) {
    const pool = new Pool({ connectionString: env.AUTH_DATABASE_URL, max: 1, connectionTimeoutMillis: 4000 });
    try {
      const r = await pool.query<{ identity: boolean; users: boolean; share: boolean; insert: boolean }>(`
        SELECT to_regclass('public."AuthIdentity"') IS NOT NULL AS identity,
               to_regclass('public."User"') IS NOT NULL AS users,
               to_regclass('public."RadarShareLink"') IS NOT NULL AS share,
               CASE WHEN to_regclass('public."AuthIdentity"') IS NULL THEN false
                    ELSE has_table_privilege('public."AuthIdentity"', 'INSERT') END AS insert`);
      const row = r.rows[0]!;
      checks.authDatabaseConnection = { ok: true };
      checks.migrationsApplied = { ok: row.identity && row.users && row.share, hint: "Rode pnpm db:migrate no banco de produção (inclui as migrações de 2026-09-25)." };
      checks.authRolePrivileges = { ok: row.insert, hint: "Rode pnpm db:provision:reapply no banco de produção." };
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      checks.authDatabaseConnection = {
        ok: false,
        hint: code === "28P01" ? "Usuário ou senha de AUTH_DATABASE_URL inválidos."
          : code === "3D000" ? "O banco indicado em AUTH_DATABASE_URL não existe."
          : "Não foi possível conectar com AUTH_DATABASE_URL (endereço, porta, SSL ou firewall).",
      };
    } finally {
      await pool.end().catch(() => undefined);
    }
  }

  const ready = Object.values(checks).every((c) => c.ok);
  const body = Object.fromEntries(Object.entries(checks).map(([k, c]) => [k, c.ok ? { ok: true } : c]));
  return Response.json({ status: ready ? "ready" : "not_ready", checks: body }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

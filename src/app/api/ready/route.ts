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

  if (env.AUTH_DATABASE_URL) {
    const pool = new Pool({ connectionString: env.AUTH_DATABASE_URL, max: 1, connectionTimeoutMillis: 4000 });
    try {
      const r = await pool.query<{ identity: boolean; users: boolean; conversas: boolean; insert: boolean }>(`
        SELECT to_regclass('public."AuthIdentity"') IS NOT NULL AS identity,
               to_regclass('public."User"') IS NOT NULL AS users,
               to_regclass('public."UserAgeConsent"') IS NOT NULL AS conversas,
               CASE WHEN to_regclass('public."AuthIdentity"') IS NULL THEN false
                    ELSE has_table_privilege('public."AuthIdentity"', 'INSERT') END AS insert`);
      const row = r.rows[0]!;
      checks.authDatabaseConnection = { ok: true };
      checks.migrationsApplied = { ok: row.identity && row.users && row.conversas, hint: "Rode pnpm db:migrate no banco de produção (falta alguma migração recente)." };
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
  const status = ready ? 200 : 503;
  const headers = { "Cache-Control": "no-store" };

  // The detailed breakdown (table names, migration/grant state, connection-error
  // category) is only for whoever is actually deploying — it's reconnaissance
  // material for anyone else. A shared secret gates it in deployed environments;
  // local/dev/test keeps the full detail for convenience. Uptime/liveness probes
  // still get a real ready/not_ready status either way, just without the "why".
  const key = env.READINESS_CHECK_KEY;
  const authorized = !deployed || (Boolean(key) && request.headers.get("x-readiness-key") === key);
  if (!authorized) return Response.json({ status: ready ? "ready" : "not_ready" }, { status, headers });

  const body = Object.fromEntries(Object.entries(checks).map(([k, c]) => [k, c.ok ? { ok: true } : c]));
  return Response.json({ status: ready ? "ready" : "not_ready", checks: body }, { status, headers });
}

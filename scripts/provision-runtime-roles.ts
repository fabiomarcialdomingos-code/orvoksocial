import "dotenv/config";
import { config as loadDotenv } from "dotenv";
import { randomBytes } from "node:crypto";
import { access, writeFile } from "node:fs/promises";
import { Client } from "pg";

// Run with owner/DBA credentials after migrations. Never run this through an
// application connection. --local creates ignored .env.local with generated
// runtime credentials; deployed environments provide both passwords via a
// secret manager and do not write them to disk.
const local = process.argv.includes("--local");
const reapplyLocal = process.argv.includes("--reapply-local");
if (local && reapplyLocal) throw new Error("SELECT_ONE_LOCAL_MODE");
if (reapplyLocal) loadDotenv({ path: ".env.local" });
const ownerUrl = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!ownerUrl) throw new Error("DB_OWNER_URL_REQUIRED");
const appPassword = local ? randomBytes(36).toString("base64url") :
  reapplyLocal ? new URL(process.env.APP_DATABASE_URL ?? "postgresql://invalid").password : process.env.APP_DB_PASSWORD;
const authPassword = local ? randomBytes(36).toString("base64url") :
  reapplyLocal ? new URL(process.env.AUTH_DATABASE_URL ?? "postgresql://invalid").password : process.env.AUTH_DB_PASSWORD;
if (!appPassword || !authPassword || appPassword.length < 32 || authPassword.length < 32)
  throw new Error("RUNTIME_ROLE_PASSWORDS_REQUIRED");
if (local) {
  try {
    await access(".env.local");
    throw new Error("ENV_LOCAL_EXISTS_REFUSING_OVERWRITE");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

const owner = new Client({ connectionString: ownerUrl });
const databaseName = decodeURIComponent(new URL(ownerUrl).pathname.slice(1));
if (!databaseName) throw new Error("DATABASE_NAME_REQUIRED");
const quotedDatabase = `"${databaseName.replaceAll('"', '""')}"`;
await owner.connect();
try {
  const identity = await owner.query<{ name: string; superuser: boolean; createRole: boolean }>(
    `SELECT current_user AS name,rolsuper AS superuser,rolcreaterole AS "createRole" FROM pg_roles WHERE rolname=current_user`,
  );
  if (!identity.rows[0]?.superuser && !identity.rows[0]?.createRole)
    throw new Error("DBA_CREATEROLE_REQUIRED");
  const expectedFunctions = await owner.query<{ count: number }>(
    `SELECT COUNT(DISTINCT proname)::integer AS count FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
      ('orvok_radar_invite','orvok_radar_accept','orvok_radar_present_notice','orvok_radar_grant',
       'orvok_radar_revoke','orvok_radar_grant_self','orvok_radar_revoke_self',
       'orvok_radar_answer','orvok_radar_predict','orvok_radar_audit_blocked')`,
  );
  if (expectedFunctions.rows[0]?.count !== 10) throw new Error("RADAR_RPC_MIGRATION_REQUIRED");
  // PostgreSQL does not parameterize CREATE/ALTER ROLE. Passwords are random
  // base64url locally, and externally supplied passwords are restricted here.
  for (const [name, password] of [
    ["orvok_auth_runtime", authPassword],
    ["orvok_app_runtime", appPassword],
  ] as const) {
    if (!/^[A-Za-z0-9_-]{32,}$/.test(password)) throw new Error("PASSWORD_FORMAT_INVALID");
    const exists = await owner.query(`SELECT 1 FROM pg_roles WHERE rolname=$1`, [name]);
    if (!exists.rowCount) await owner.query(`CREATE ROLE ${name} LOGIN NOINHERIT PASSWORD '${password}'`);
    else await owner.query(`ALTER ROLE ${name} LOGIN NOINHERIT PASSWORD '${password}'`);
  }
  await owner.query("BEGIN");
  try {
    await owner.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
    await owner.query(`GRANT CONNECT ON DATABASE ${quotedDatabase} TO orvok_auth_runtime,orvok_app_runtime`);
    await owner.query(`GRANT USAGE ON SCHEMA public TO orvok_auth_runtime,orvok_app_runtime`);
    await owner.query(`GRANT USAGE ON TYPE "UserStatus","UserRole","AuthTokenPurpose",
      "ConsentPurpose","ConsentNoticeStatus","DataRequestType","DataRequestStatus",
      "NotificationState","ApiIdempotencyState","VisibilityScope","EvidenceDomain",
      "EvidenceState","QuestionDomain" TO orvok_auth_runtime,orvok_app_runtime`);
    await owner.query(`GRANT USAGE ON TYPE "RadarCatalogStatus" TO orvok_auth_runtime,orvok_app_runtime`);

    await owner.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM orvok_auth_runtime,orvok_app_runtime`);
    await owner.query(`GRANT SELECT ON "User" TO orvok_auth_runtime`);
    await owner.query(`GRANT INSERT (id,"updatedAt") ON "User" TO orvok_auth_runtime`);
    await owner.query(`GRANT SELECT,INSERT,UPDATE ON "AuthIdentity","AuthSession","AuthToken","AuthRateLimit","AuthMailOutbox","AuditLog" TO orvok_auth_runtime`);
    await owner.query(`GRANT SELECT ON "User","Question","QuestionVersion","AnswerOption","ConsentGrant",
      "ConsentRevocation","AnswerVersion","RadarInvitation","RadarInvitationAcceptance",
      "SocialPredictionSnapshot","ConsentNotice","ConsentNoticePresentation","DataRequest",
      "Notification","ApiIdempotency","AuditLog" TO orvok_app_runtime`);
    await owner.query(`GRANT SELECT ("userId",email,"verifiedAt") ON "AuthIdentity" TO orvok_app_runtime`);
    await owner.query(`GRANT SELECT,INSERT,UPDATE ON "DataRequest","ApiIdempotency" TO orvok_app_runtime`);
    await owner.query(`GRANT UPDATE (state,"readAt","dismissedAt") ON "Notification" TO orvok_app_runtime`);
    // Operational request/export audit is append-only. Radar audit rows are
    // emitted by the privileged functions; no Radar table DML is granted.
    await owner.query(`GRANT INSERT ON "AuditLog" TO orvok_app_runtime`);
    await owner.query(`REVOKE ALL ON FUNCTION
      orvok_radar_invite(text,uuid),orvok_radar_accept(text,uuid),
      orvok_radar_present_notice(text,"ConsentPurpose"),
      orvok_radar_present_notice(text,"ConsentPurpose",uuid),
      orvok_radar_grant(text,uuid,uuid,"VisibilityScope",text,text),
      orvok_radar_revoke(text,uuid),orvok_radar_grant_self(text,uuid,text,text),
      orvok_radar_revoke_self(text,uuid),orvok_radar_answer(text,uuid,uuid,uuid,uuid),
      orvok_radar_predict(text,uuid,uuid,uuid,uuid,jsonb,uuid),
      orvok_radar_audit_blocked(text,text,text,uuid,text) FROM PUBLIC,orvok_auth_runtime,orvok_app_runtime`);
    await owner.query(`GRANT EXECUTE ON FUNCTION
      orvok_radar_invite(text,uuid),orvok_radar_accept(text,uuid),
      orvok_radar_present_notice(text,"ConsentPurpose"),
      orvok_radar_present_notice(text,"ConsentPurpose",uuid),
      orvok_radar_grant(text,uuid,uuid,"VisibilityScope",text,text),
      orvok_radar_revoke(text,uuid),orvok_radar_grant_self(text,uuid,text,text),
      orvok_radar_revoke_self(text,uuid),orvok_radar_answer(text,uuid,uuid,uuid,uuid),
      orvok_radar_predict(text,uuid,uuid,uuid,uuid,jsonb,uuid),
      orvok_radar_audit_blocked(text,text,text,uuid,text) TO orvok_app_runtime`);
    await owner.query(`REVOKE ALL ON FUNCTION
      orvok_read_actor(),orvok_read_role(),orvok_snapshot_visible(uuid),
      orvok_read_snapshot(uuid),orvok_export_restricted_predictions(uuid),
      orvok_export_received_predictions(uuid),orvok_bind_read_actor(text),
      orvok_app_rate_attempt(text) FROM PUBLIC,orvok_auth_runtime,orvok_app_runtime`);
    await owner.query(`REVOKE ALL ON FUNCTION
      orvok_radar_present_notice_core(text,"ConsentPurpose"),
      orvok_radar_answer_core(text,uuid,uuid,uuid,uuid),
      orvok_radar_predict_core(text,uuid,uuid,uuid,uuid,jsonb,uuid)
      FROM PUBLIC,orvok_auth_runtime,orvok_app_runtime`);
    await owner.query(`GRANT EXECUTE ON FUNCTION
      orvok_read_actor(),orvok_read_role(),orvok_snapshot_visible(uuid),
      orvok_read_snapshot(uuid),orvok_export_restricted_predictions(uuid),
      orvok_export_received_predictions(uuid),orvok_bind_read_actor(text),
      orvok_app_rate_attempt(text),orvok_catalog_version_enabled(uuid),
      orvok_catalog_test_configured(),orvok_catalog_test_material_present(),
      orvok_radar_opportunities(text),orvok_radar_mutual_connections(text)
      TO orvok_app_runtime`);
    await owner.query(`REVOKE ALL ON FUNCTION orvok_radar_actor(text) FROM orvok_app_runtime,orvok_auth_runtime,PUBLIC`);
    await owner.query("COMMIT");
  } catch (error) {
    await owner.query("ROLLBACK");
    throw error;
  }
  if (local) {
    const appUrl = new URL(ownerUrl);
    appUrl.username = "orvok_app_runtime";
    appUrl.password = appPassword;
    const authUrl = new URL(ownerUrl);
    authUrl.username = "orvok_auth_runtime";
    authUrl.password = authPassword;
    await writeFile(".env.local", `APP_DATABASE_URL=${JSON.stringify(appUrl.toString())}\nAUTH_DATABASE_URL=${JSON.stringify(authUrl.toString())}\n`, { flag: "wx", mode: 0o600 });
  }
  console.log("runtime roles provisioned; Radar DML withheld; RPC execution granted only to app role");
} finally {
  await owner.end();
}

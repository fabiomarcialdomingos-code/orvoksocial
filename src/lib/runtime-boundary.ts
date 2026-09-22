/** Reject owner credentials in deployed web and worker processes. */
export function assertRuntimeDatabaseBoundary(env: Partial<NodeJS.ProcessEnv> = process.env): void {
  if (env.APP_ENV !== "staging" && env.APP_ENV !== "production") return;
  if (env.DATABASE_URL || env.DB_OWNER_URL)
    throw new Error("OWNER_DATABASE_CREDENTIAL_IN_RUNTIME");
  if (!env.APP_DATABASE_URL || !env.AUTH_DATABASE_URL)
    throw new Error("RUNTIME_DATABASE_CREDENTIALS_REQUIRED");
}

-- The auth runtime creates accounts and may promote the configured bootstrap
-- administrator. Keep the grant limited to the columns used by AuthService.
GRANT INSERT (id, role, "updatedAt"), UPDATE (role, "updatedAt")
ON "User" TO orvok_auth_runtime;

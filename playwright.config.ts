import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { randomBytes } from "node:crypto";

loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", override: false, quiet: true });
// The local runtime keeps application and owner connections separate. E2E
// fixtures need the owner connection explicitly, while preserving an
// already-provided DATABASE_URL in CI or an isolated test environment.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.APP_DATABASE_URL ?? process.env.AUTH_DATABASE_URL;
}
process.env.APP_ORIGIN ??= "http://127.0.0.1:3000";
process.env.AUTH_SECRET ??= randomBytes(32).toString("hex");
process.env.AUTH_MAIL_KEY ??= randomBytes(32).toString("hex");

export default defineConfig({
  testDir: "./tests/e2e",
  // Real Radar fixtures share one isolated PostgreSQL database. Serializing
  // the suite prevents independent workers from racing on cleanup and locks.
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "corepack pnpm start --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
});

import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { randomBytes } from "node:crypto";

loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", override: false, quiet: true });
process.env.APP_ORIGIN ??= "http://127.0.0.1:3000";
process.env.AUTH_SECRET ??= randomBytes(32).toString("hex");
process.env.AUTH_MAIL_KEY ??= randomBytes(32).toString("hex");

export default defineConfig({
  testDir: "./tests/e2e",
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

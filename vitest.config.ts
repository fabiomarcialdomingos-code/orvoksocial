import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv();
loadEnv({ path: ".env.local", override: false });

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: { provider: "v8" },
  },
});

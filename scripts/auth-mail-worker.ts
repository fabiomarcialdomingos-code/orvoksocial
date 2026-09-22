import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { authPool } from "../src/lib/auth/session";
import { createAuthMailer, deliverNextAuthMail } from "../src/lib/auth/mail";

loadEnv({ path: ".env.local", override: false });
const send = createAuthMailer();
const pool = authPool();
let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

while (running) {
  const result = await deliverNextAuthMail(pool, send);
  if (result === "idle" || result === "retry") {
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
await pool.end();

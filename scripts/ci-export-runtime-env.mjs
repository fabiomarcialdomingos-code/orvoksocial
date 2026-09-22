import { appendFileSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

const destination = process.env.GITHUB_ENV;
if (!destination) {
  throw new Error("GITHUB_ENV is required in CI");
}

const localEnvironment = parse(readFileSync(".env.local"));
for (const key of ["APP_DATABASE_URL", "AUTH_DATABASE_URL"]) {
  const value = localEnvironment[key];
  if (!value || /[\r\n]/u.test(value)) {
    throw new Error(`${key} is missing or invalid`);
  }
  appendFileSync(destination, `${key}=${value}\n`, { mode: 0o600 });
}

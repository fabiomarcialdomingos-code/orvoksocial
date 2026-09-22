import { z } from "zod";

const databaseUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "postgresql:" || protocol === "postgres:";
}, "DATABASE_URL must use the PostgreSQL protocol");

export const serverEnvSchema = z.object({
  DATABASE_URL: databaseUrl,
  APP_ENV: z.enum(["development", "test", "staging", "production"]),
});

export function parseServerEnv(input: Record<string, unknown>) {
  return serverEnvSchema.parse(input);
}

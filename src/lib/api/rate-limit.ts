import { Pool } from "pg";
import { z } from "zod";
import { OperationalApiError } from "./response";

export async function enforceOperationalRateLimit(pool: Pool, route: string) {
  const limit = z.coerce.number().int().min(1).max(10_000).parse(process.env.ORVOK_API_MUTATION_RATE_PER_MIN ?? 60);
  const result = await pool.query<{ attempts: number }>(`SELECT orvok_app_rate_attempt($1) AS attempts`, [route]);
  if ((result.rows[0]?.attempts ?? 0) > limit) throw new OperationalApiError(429, "RATE_LIMITED");
}

import type { Pool } from "pg";
import { tokenHash } from "@/lib/auth/crypto";
import { AuthError } from "@/lib/auth/session";

/**
 * Limite de ações por janela de tempo (mesma tabela do restante do app). Conta cada
 * chamada e recusa com 429 quando passa de `max` dentro de `segundos`. O "escopo"
 * separa os contadores de cada parte do produto (desafio, mundo…).
 */
export async function limitar(pool: Pool, escopo: string, chave: string, max: number, segundos: number): Promise<void> {
  const r = await pool.query<{ attempts: number }>(
    `INSERT INTO "AuthRateLimit" ("keyHash",attempts,"resetsAt") VALUES ($1,1,clock_timestamp()+($2::int * interval '1 second'))
     ON CONFLICT ("keyHash") DO UPDATE SET
       attempts=CASE WHEN "AuthRateLimit"."resetsAt" <= clock_timestamp() THEN 1 ELSE "AuthRateLimit".attempts+1 END,
       "resetsAt"=CASE WHEN "AuthRateLimit"."resetsAt" <= clock_timestamp() THEN clock_timestamp()+($2::int * interval '1 second') ELSE "AuthRateLimit"."resetsAt" END
     RETURNING attempts`,
    [tokenHash(`rate:${escopo}:${chave}`), segundos],
  );
  if ((r.rows[0]?.attempts ?? max + 1) > max) throw new AuthError("RATE_LIMITED", 429);
}

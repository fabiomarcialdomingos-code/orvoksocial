import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { z } from "zod";
import { OperationalApiError } from "./response";

const keySchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/);

export async function withIdempotency<T extends Record<string, unknown>>(
  pool: Pool,
  actorId: string,
  route: string,
  keyHeader: string | null,
  body: unknown,
  work: () => Promise<{ status: number; data: T }>,
  revalidateReplay?: (data: T) => Promise<void>,
): Promise<{ status: number; data: T }> {
  const key = keySchema.parse(keyHeader);
  const requestHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const inserted = await pool.query(
    `INSERT INTO "ApiIdempotency" (id,"actorId",route,key,"requestHash",state,"createdAt") VALUES ($1,$2,$3,$4,$5,'PENDING',clock_timestamp()) ON CONFLICT ("actorId",route,key) DO NOTHING RETURNING id`,
    [randomUUID(), actorId, route, key, requestHash],
  );
  if (!inserted.rowCount) {
    const prior = await pool.query<{
      requestHash: string;
      state: string;
      responseStatus: number | null;
      responseBody: T | null;
    }>(
      `SELECT "requestHash",state,"responseStatus","responseBody" FROM "ApiIdempotency" WHERE "actorId"=$1 AND route=$2 AND key=$3`,
      [actorId, route, key],
    );
    const row = prior.rows[0];
    if (!row || row.requestHash !== requestHash || row.state !== "COMPLETED" || !row.responseBody || !row.responseStatus)
      throw new OperationalApiError(409, "CONFLICT");
    if (revalidateReplay) await revalidateReplay(row.responseBody);
    return { status: row.responseStatus, data: row.responseBody };
  }
  try {
    const result = await work();
    await pool.query(
      `UPDATE "ApiIdempotency" SET state='COMPLETED',"responseStatus"=$4,"responseBody"=$5::jsonb WHERE "actorId"=$1 AND route=$2 AND key=$3 AND state='PENDING'`,
      [actorId, route, key, result.status, JSON.stringify(result.data)],
    );
    return result;
  } catch (error) {
    // A pending record is deliberately retained. Reconciliation must check the
    // underlying operation before allowing a retry after a crash or DB failure.
    throw error;
  }
}

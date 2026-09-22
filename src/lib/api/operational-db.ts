import { Pool, type PoolClient } from "pg";
import { assertRuntimeDatabaseBoundary } from "../runtime-boundary";

let rawPool: Pool | undefined;

export async function closeOperationalPool(): Promise<void> {
  const pool = rawPool;
  rawPool = undefined;
  if (pool) await pool.end();
}

/** Bind every app-role statement to a verified session hash using SET LOCAL.
 * The setting dies at COMMIT/ROLLBACK and cannot leak to the next pool user. */
export function operationalPool(sessionHash: string): Pool {
  assertRuntimeDatabaseBoundary();
  if (!/^[a-f0-9]{64}$/.test(sessionHash)) throw new Error("SESSION_HASH_REQUIRED");
  if (!rawPool) {
    const connectionString = process.env.APP_DATABASE_URL;
    if (!connectionString) throw new Error("APP_DATABASE_URL_REQUIRED");
    rawPool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 3_000 });
  }
  const backing = rawPool;
  const acquire = async (): Promise<PoolClient> => {
    const client = await backing.connect();
    let inTransaction = false;
    let released = false;
    const originalQuery = client.query.bind(client) as PoolClient["query"];
    const originalRelease = client.release.bind(client);
    const scoped = Object.create(client) as PoolClient;
    const begin = async (sql: string) => {
      const result = await originalQuery(sql);
      try {
        await originalQuery("SELECT orvok_bind_read_actor($1)", [sessionHash]);
        inTransaction = true;
      } catch (error) {
        await originalQuery("ROLLBACK");
        throw error;
      }
      return result;
    };
    scoped.query = (async (sql: string, values?: unknown[]) => {
      const command = sql.trimStart().split(/\s/, 1)[0]?.toUpperCase();
      if (command === "BEGIN" || command === "START") {
        if (inTransaction) throw new Error("NESTED_TRANSACTION_FORBIDDEN");
        return begin(sql);
      }
      if (command === "COMMIT" || command === "ROLLBACK") {
        if (!inTransaction) throw new Error("TRANSACTION_NOT_OPEN");
        try { return await originalQuery(sql, values); }
        finally { inTransaction = false; }
      }
      const automatic = !inTransaction;
      if (automatic) await begin("BEGIN");
      try {
        const result = await originalQuery(sql, values);
        if (automatic) { await originalQuery("COMMIT"); inTransaction = false; }
        return result;
      } catch (error) {
        if (automatic) {
          try { await originalQuery("ROLLBACK"); } finally { inTransaction = false; }
        }
        throw error;
      }
    }) as PoolClient["query"];
    scoped.release = ((destroy?: boolean) => {
      if (released) return;
      released = true;
      if (inTransaction) {
        void originalQuery("ROLLBACK").then(
          () => originalRelease(destroy),
          () => originalRelease(true),
        );
      } else originalRelease(destroy);
    }) as PoolClient["release"];
    return scoped;
  };
  return {
    connect: acquire,
    query: async (sql: string, values?: unknown[]) => {
      const client = await acquire();
      try { return await client.query(sql, values); }
      finally { client.release(); }
    },
  } as unknown as Pool;
}

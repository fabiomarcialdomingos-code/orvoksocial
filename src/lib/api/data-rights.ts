import { randomUUID } from "node:crypto";
import { Pool } from "pg";

export class DataRightsService {
  constructor(private readonly pool: Pool) {}

  async streamOwnData(actorId: string, signal: AbortSignal): Promise<Response> {
    await this.pool.query(
      `INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt") VALUES ($1,$2,'DATA_EXPORT','User',$2,clock_timestamp())`,
      [randomUUID(), actorId],
    );
    const client = await this.pool.connect();
    try {
      // The session-boundary function takes a SHARE lock so revocation waits
      // until the export ends; PostgreSQL forbids that lock in READ ONLY mode.
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await client.query(`SET LOCAL idle_in_transaction_session_timeout = '130s'`);
      const profile = await client.query(
        `SELECT u.id,u.status,u."createdAt",ai.email,ai."verifiedAt" FROM "User" u LEFT JOIN "AuthIdentity" ai ON ai."userId"=u.id WHERE u.id=$1`,
        [actorId],
      );
      const sections = [
        ["consentGrants", `SELECT id,purpose,scope,"noticeVersion","noticeHash","consentVersion","grantedAt" FROM "ConsentGrant" WHERE "subjectId"=$1 AND id>$2::uuid ORDER BY id LIMIT 100`],
        ["consentRevocations", `SELECT id,"grantId","revokedAt" FROM "ConsentRevocation" WHERE "subjectId"=$1 AND id>$2::uuid ORDER BY id LIMIT 100`],
        ["answers", `SELECT id,"questionVersionId","optionId",version,"answeredAt","consentGrantId" FROM "AnswerVersion" WHERE "subjectId"=$1 AND id>$2::uuid ORDER BY id LIMIT 100`],
        ["invitationsSent", `SELECT id,"targetId","invitedAt" FROM "RadarInvitation" WHERE "predictorId"=$1 AND id>$2::uuid ORDER BY id LIMIT 100`],
        ["invitationsReceived", `SELECT id,"predictorId","invitedAt" FROM "RadarInvitation" WHERE "targetId"=$1 AND id>$2::uuid ORDER BY id LIMIT 100`],
        ["predictionsMade", `SELECT id,"targetId","questionVersionId","probabilityVector","predictedAt","targetConsentVersion" FROM "SocialPredictionSnapshot" WHERE "predictorId"=$1 AND id>$2::uuid ORDER BY id LIMIT 100`],
        ["restrictedPredictionsMetadata", `SELECT * FROM orvok_export_restricted_predictions($2::uuid) WHERE orvok_read_actor()=$1::uuid`],
        ["predictionsReceivedMetadata", `SELECT * FROM orvok_export_received_predictions($2::uuid) WHERE orvok_read_actor()=$1::uuid`],
        ["auditActions", `SELECT id,action,"objectType","objectId","occurredAt" FROM "AuditLog" WHERE "actorId"=$1 AND id>$2::uuid ORDER BY id LIMIT 100`],
        ["dataRequests", `SELECT id,type,status,"requestedAt" FROM "DataRequest" WHERE "subjectId"=$1 AND id>$2::uuid ORDER BY id LIMIT 100`],
        ["notifications", `SELECT id,"eventType",state,"createdAt" FROM "Notification" WHERE "recipientId"=$1 AND id>$2::uuid ORDER BY id LIMIT 100`],
      ] as const;
      const startedAt = Date.now();
      const encoder = new TextEncoder();
      const maxBytes = 100 * 1024 * 1024;
      let written = 0;
      async function* chunks() {
        yield `{"schemaVersion":"1","export":{"generatedAt":${JSON.stringify(new Date().toISOString())},"profile":${JSON.stringify(profile.rows[0] ?? null)}`;
        for (const [name, sql] of sections) {
          yield `,"${name}":[`;
          let cursor = "00000000-0000-0000-0000-000000000000";
          let first = true;
          for (;;) {
            if (signal.aborted || Date.now() - startedAt > 120_000) throw new Error("EXPORT_ABORTED_OR_TIMED_OUT");
            const rows = (await client.query<{ id: string }>(sql, [actorId, cursor])).rows;
            for (const row of rows) {
              yield `${first ? "" : ","}${JSON.stringify(row)}`;
              first = false;
              cursor = row.id;
            }
            if (rows.length < 100) break;
          }
          yield "]";
        }
        yield "}}";
      }
      const iterator = chunks()[Symbol.asyncIterator]();
      let closed = false;
      const timeout = setTimeout(() => { void close(); }, 120_000);
      const close = async () => {
        if (closed) return;
        closed = true;
        clearTimeout(timeout);
        signal.removeEventListener("abort", onAbort);
        try { await client.query("ROLLBACK"); } finally { client.release(); }
      };
      const onAbort = () => { void close(); };
      signal.addEventListener("abort", onAbort, { once: true });
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const next = await iterator.next();
            if (next.done) { await close(); controller.close(); return; }
            const bytes = encoder.encode(next.value);
            written += bytes.byteLength;
            if (written > maxBytes) throw new Error("EXPORT_SIZE_LIMIT");
            controller.enqueue(bytes);
          } catch (error) {
            await close();
            controller.error(error);
          }
        },
        async cancel() { await iterator.return?.(); await close(); },
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Disposition": "attachment; filename=orvok-data-export.json" } });
    } catch (error) {
      await client.query("ROLLBACK");
      client.release();
      throw error;
    }
  }

  async requestDataAction(actorId: string, type: "ERASURE" | "EXPORT"): Promise<string> {
    const id = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO "DataRequest" (id,"subjectId",type,status,"requestedAt","updatedAt") VALUES ($1,$2,$3,'RECEIVED',clock_timestamp(),clock_timestamp())`,
        [id, actorId, type],
      );
      await client.query(
        `INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt") VALUES ($1,$2,$3,'DataRequest',$4,clock_timestamp())`,
        [randomUUID(), actorId, type === "ERASURE" ? "DATA_ERASURE_REQUESTED" : "DATA_EXPORT_REQUESTED", id],
      );
      await client.query("COMMIT");
      return id;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

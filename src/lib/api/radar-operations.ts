import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";
import { OperationalApiError } from "./response";

const uuid = z.uuid();
const hash64 = z.string().regex(/^[a-f0-9]{64}$/);
export const answerInput = z.strictObject({
  questionVersionId: uuid,
  optionId: uuid,
  consentGrantId: uuid,
  supersedesId: uuid.optional(),
});
export const noticeInput = z.strictObject({
  purpose: z.enum(["SELF_ANSWER", "BE_PREDICTED"]),
  noticeVersion: z.string().min(1).max(80),
  noticeHash: hash64,
});

async function audit(
  client: PoolClient,
  actorId: string,
  action: string,
  objectType: string,
  objectId: string,
) {
  await client.query(
    `INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt") VALUES ($1,$2,$3,$4,$5,clock_timestamp())`,
    [randomUUID(), actorId, action, objectType, objectId],
  );
}

export class RadarOperations {
  constructor(private readonly pool: Pool) {}

  async approvedNotice(purpose: "SELF_ANSWER" | "BE_PREDICTED") {
    const result = await this.pool.query<{
      id: string;
      version: string;
      contentHash: string;
      content: string;
    }>(
      `SELECT id,version,"contentHash",content FROM "ConsentNotice" WHERE purpose=$1 AND status='APPROVED' ORDER BY "approvedAt" DESC LIMIT 1`,
      [purpose],
    );
    if (!result.rows[0]) throw new OperationalApiError(503, "NOTICE_UNAVAILABLE");
    return result.rows[0];
  }

  async presentNotice(actorId: string, sessionId: string, purpose: "SELF_ANSWER" | "BE_PREDICTED") {
    const notice = await this.approvedNotice(purpose);
    const presentationId = randomUUID();
    await this.pool.query(
      `INSERT INTO "ConsentNoticePresentation" (id,"userId","noticeId","sessionId","presentedAt") VALUES ($1,$2,$3,$4,clock_timestamp())`,
      [presentationId, actorId, notice.id, sessionId],
    );
    return { version: notice.version, contentHash: notice.contentHash, content: notice.content, presentationId };
  }

  async assertApprovedNotice(input: z.infer<typeof noticeInput>) {
    const found = await this.pool.query(
      `SELECT 1 FROM "ConsentNotice" WHERE purpose=$1 AND version=$2 AND "contentHash"=$3 AND status='APPROVED'`,
      [input.purpose, input.noticeVersion, input.noticeHash],
    );
    if (!found.rowCount) throw new OperationalApiError(422, "RULE_VIOLATION");
  }

  async grantSelfAnswerConsent(
    actorId: string,
    notice: z.infer<typeof noticeInput>,
    presentationId: string,
    sessionId: string,
  ): Promise<{ id: string; version: number }> {
    if (notice.purpose !== "SELF_ANSWER")
      throw new OperationalApiError(422, "RULE_VIOLATION");
    await this.assertApprovedNotice(notice);
    const client = await this.pool.connect();
    const id = randomUUID();
    try {
      await client.query("BEGIN");
      const user = await client.query(`SELECT id FROM "User" WHERE id=$1 AND status='ACTIVE' FOR UPDATE`, [actorId]);
      if (!user.rowCount) throw new OperationalApiError(403, "FORBIDDEN");
      const presentation = await client.query(
        `SELECT 1 FROM "ConsentNoticePresentation" p JOIN "ConsentNotice" n ON n.id=p."noticeId" WHERE p.id=$1 AND p."userId"=$2 AND p."sessionId"=$3 AND n.purpose='SELF_ANSWER' AND n.version=$4 AND n."contentHash"=$5 AND p."presentedAt"<clock_timestamp()`,
        [presentationId, actorId, sessionId, notice.noticeVersion, notice.noticeHash],
      );
      if (!presentation.rowCount) throw new OperationalApiError(422, "RULE_VIOLATION");
      const next = await client.query<{ version: number }>(
        `SELECT COALESCE(MAX("consentVersion"),0)+1 AS version FROM "ConsentGrant" WHERE "subjectId"=$1 AND purpose='SELF_ANSWER'`,
        [actorId],
      );
      const version = Number(next.rows[0]?.version);
      await client.query(
        `INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","consentVersion","noticePresentationId","grantedAt") VALUES ($1,$2,'SELF_ANSWER','PRIVATE',$3,$4,$5,$6,clock_timestamp())`,
        [id, actorId, notice.noticeVersion, notice.noticeHash, version, presentationId],
      );
      await audit(client, actorId, "SELF_ANSWER_CONSENT_GRANTED", "ConsentGrant", id);
      await client.query("COMMIT");
      return { id, version };
    } catch (error) {
      await client.query("ROLLBACK");
      await this.pool.query(
        `INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt") VALUES ($1,$2,'SELF_ANSWER_CONSENT_GRANT_BLOCKED','ConsentGrant',$3,clock_timestamp())`,
        [randomUUID(), actorId, id],
      );
      throw error;
    } finally {
      client.release();
    }
  }

  async createAnswer(actorId: string, raw: unknown): Promise<{ id: string; version: number }> {
    const input = answerInput.parse(raw);
    const client = await this.pool.connect();
    const id = randomUUID();
    try {
      await client.query("BEGIN");
      const grant = await client.query<{ grantedAt: Date }>(
        `SELECT g."grantedAt" FROM "ConsentGrant" g JOIN "User" u ON u.id=g."subjectId" WHERE g.id=$1 AND g."subjectId"=$2 AND g.purpose='SELF_ANSWER' AND u.status='ACTIVE' FOR UPDATE OF g`,
        [input.consentGrantId, actorId],
      );
      if (!grant.rows[0]) throw new OperationalApiError(422, "RULE_VIOLATION");
      const revoked = await client.query(`SELECT 1 FROM "ConsentRevocation" WHERE "grantId"=$1`, [input.consentGrantId]);
      if (revoked.rowCount) throw new OperationalApiError(422, "RULE_VIOLATION");
      const option = await client.query(
        `SELECT 1 FROM "AnswerOption" ao JOIN "QuestionVersion" qv ON qv.id=ao."questionVersionId" JOIN "Question" q ON q.id=qv."questionId" WHERE ao.id=$1 AND ao."questionVersionId"=$2 AND q.domain='RADAR'`,
        [input.optionId, input.questionVersionId],
      );
      if (!option.rowCount) throw new OperationalApiError(404, "NOT_FOUND");
      const previous = await client.query<{ id: string; version: number }>(
        `SELECT id,version FROM "AnswerVersion" WHERE "subjectId"=$1 AND "questionVersionId"=$2 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
        [actorId, input.questionVersionId],
      );
      if (previous.rows[0]?.id !== input.supersedesId && (previous.rows[0] || input.supersedesId))
        throw new OperationalApiError(409, "CONFLICT");
      const version = (previous.rows[0]?.version ?? 0) + 1;
      const answeredAt = (await client.query<{ at: Date }>(`SELECT clock_timestamp() AS at`)).rows[0]!.at;
      if (grant.rows[0].grantedAt >= answeredAt) throw new OperationalApiError(422, "RULE_VIOLATION");
      const snapshotHash = createHash("sha256")
        .update(JSON.stringify({ id, actorId, ...input, version, answeredAt: answeredAt.toISOString() }))
        .digest("hex");
      await client.query(
        `INSERT INTO "AnswerVersion" (id,"subjectId","questionVersionId","optionId","consentGrantId",version,"supersedesId","answeredAt","snapshotHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, actorId, input.questionVersionId, input.optionId, input.consentGrantId, version, input.supersedesId ?? null, answeredAt, snapshotHash],
      );
      await audit(client, actorId, "RADAR_SELF_ANSWER_CREATED", "AnswerVersion", id);
      await client.query("COMMIT");
      return { id, version };
    } catch (error) {
      await client.query("ROLLBACK");
      await this.pool.query(
        `INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt") VALUES ($1,$2,'RADAR_SELF_ANSWER_BLOCKED','AnswerVersion',$3,clock_timestamp())`,
        [randomUUID(), actorId, id],
      );
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeSelfAnswerConsent(actorId: string, grantId: string): Promise<string> {
    const id = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const grant = await client.query(
        `SELECT id FROM "ConsentGrant" WHERE id=$1 AND "subjectId"=$2 AND purpose='SELF_ANSWER' FOR UPDATE`,
        [grantId, actorId],
      );
      if (!grant.rowCount) throw new OperationalApiError(404, "NOT_FOUND");
      await client.query(
        `INSERT INTO "ConsentRevocation" (id,"grantId","subjectId","revokedAt") VALUES ($1,$2,$3,clock_timestamp())`,
        [id, grantId, actorId],
      );
      await audit(client, actorId, "SELF_ANSWER_CONSENT_REVOKED", "ConsentGrant", grantId);
      await client.query("COMMIT");
      return id;
    } catch (error) {
      await client.query("ROLLBACK");
      await this.pool.query(
        `INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt") VALUES ($1,$2,'SELF_ANSWER_CONSENT_REVOKE_BLOCKED','ConsentGrant',$3,clock_timestamp())`,
        [randomUUID(), actorId, grantId],
      );
      throw error;
    } finally {
      client.release();
    }
  }
}

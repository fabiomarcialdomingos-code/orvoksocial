import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";
import { isRadarOrderValid } from "./radar-temporal";

const uuid = z.uuid();
const notice = z.object({
  version: z.string().min(1).max(80),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});
const invitationInput = z.object({ predictorId: uuid, targetId: uuid });
const acceptanceInput = z.object({ invitationId: uuid, targetId: uuid });
const grantInput = z.object({
  acceptanceId: uuid,
  targetId: uuid,
  notice,
  presentationId: uuid,
  sessionId: uuid,
  scope: z.enum(["PRIVATE", "SHARED"]),
});
const revokeInput = z.object({ grantId: uuid, targetId: uuid });
const predictionInput = z.object({
  predictorId: uuid,
  targetId: uuid,
  questionVersionId: uuid,
  selfAnswerVersionId: uuid,
  grantId: uuid,
  probabilityVector: z.array(z.number().finite().min(0).max(1)).min(2),
  supersedesId: uuid.optional(),
});

export class RadarInvariantError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "RadarInvariantError";
  }
}

type Row = Record<string, unknown>;
type AuditContext = {
  actorId: string;
  objectId: string;
  objectType: string;
  action: string;
};

export class RadarConsentService {
  constructor(private readonly pool: Pool) {}

  private async transaction<T>(
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async audit(
    client: PoolClient,
    actorId: string,
    action: string,
    objectType: string,
    objectId: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt") VALUES ($1,$2,$3,$4,$5,clock_timestamp())`,
      [randomUUID(), actorId, action, objectType, objectId],
    );
  }

  private async guarded<T>(
    context: AuditContext,
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.transaction(work);
    } catch (error) {
      // A rejected transaction cannot contain its own audit record: persist rejection separately.
      const reason =
        error instanceof RadarInvariantError ? error.code : "DATABASE_REJECTED";
      await this.transaction((client) =>
        this.audit(
          client,
          context.actorId,
          `${context.action}_BLOCKED_${reason}`,
          context.objectType,
          context.objectId,
        ),
      );
      throw error;
    }
  }

  async invite(raw: unknown): Promise<string> {
    const input = invitationInput.parse(raw);
    const id = randomUUID();
    await this.guarded(
      {
        actorId: input.predictorId,
        action: "RADAR_INVITE",
        objectType: "RadarInvitation",
        objectId: id,
      },
      async (client) => {
        if (input.predictorId === input.targetId)
          throw new RadarInvariantError("SAME_PERSON");
        await client.query(
          `INSERT INTO "RadarInvitation" (id,"predictorId","targetId","invitedAt") VALUES ($1,$2,$3,clock_timestamp())`,
          [id, input.predictorId, input.targetId],
        );
      },
    );
    return id;
  }

  async accept(raw: unknown): Promise<string> {
    const input = acceptanceInput.parse(raw);
    const id = randomUUID();
    await this.guarded(
      {
        actorId: input.targetId,
        action: "RADAR_ACCEPT",
        objectType: "RadarInvitation",
        objectId: input.invitationId,
      },
      async (client) => {
        const found = await client.query<Row>(
          `SELECT id FROM "RadarInvitation" WHERE id=$1 AND "targetId"=$2 FOR UPDATE`,
          [input.invitationId, input.targetId],
        );
        if (!found.rowCount)
          throw new RadarInvariantError("INVITATION_MISSING");
        await client.query(
          `INSERT INTO "RadarInvitationAcceptance" (id,"invitationId","targetId","acceptedAt") VALUES ($1,$2,$3,clock_timestamp())`,
          [id, input.invitationId, input.targetId],
        );
      },
    );
    return id;
  }

  async grant(raw: unknown): Promise<{ id: string; version: number }> {
    const input = grantInput.parse(raw);
    const id = randomUUID();
    return this.guarded(
      {
        actorId: input.targetId,
        action: "RADAR_CONSENT_GRANT",
        objectType: "ConsentGrant",
        objectId: id,
      },
      async (client) => {
        const user = await client.query<Row>(
          `SELECT id FROM "User" WHERE id=$1 AND status='ACTIVE' FOR UPDATE`,
          [input.targetId],
        );
        if (!user.rowCount) throw new RadarInvariantError("TARGET_INACTIVE");
        const accepted = await client.query<Row>(
          `SELECT id FROM "RadarInvitationAcceptance" WHERE id=$1 AND "targetId"=$2`,
          [input.acceptanceId, input.targetId],
        );
        if (!accepted.rowCount)
          throw new RadarInvariantError("ACCEPTANCE_MISSING");
        const active = await client.query(
          `SELECT 1 FROM "ConsentGrant" g WHERE g."invitationAcceptanceId"=$1 AND g.purpose='BE_PREDICTED' AND NOT EXISTS (SELECT 1 FROM "ConsentRevocation" r WHERE r."grantId"=g.id) LIMIT 1`,
          [input.acceptanceId],
        );
        if (active.rowCount)
          throw new RadarInvariantError("CONSENT_ALREADY_ACTIVE");
        const presented = await client.query(
          `SELECT 1 FROM "ConsentNoticePresentation" p JOIN "ConsentNotice" n ON n.id=p."noticeId" WHERE p.id=$1 AND p."userId"=$2 AND p."sessionId"=$3 AND n.purpose='BE_PREDICTED' AND n.version=$4 AND n."contentHash"=$5 AND n.status='APPROVED' AND p."presentedAt"<clock_timestamp()`,
          [input.presentationId, input.targetId, input.sessionId, input.notice.version, input.notice.hash],
        );
        if (!presented.rowCount)
          throw new RadarInvariantError("NOTICE_NOT_PRESENTED");
        const versionRow = await client.query<{ next: number }>(
          `SELECT COALESCE(MAX("consentVersion"),0)+1 AS next FROM "ConsentGrant" WHERE "subjectId"=$1 AND purpose='BE_PREDICTED'`,
          [input.targetId],
        );
        const version = Number(versionRow.rows[0]?.next);
        await client.query(
          `INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","consentVersion","invitationAcceptanceId","noticePresentationId","grantedAt") VALUES ($1,$2,'BE_PREDICTED',$3,$4,$5,$6,$7,$8,clock_timestamp())`,
          [
            id,
            input.targetId,
            input.scope,
            input.notice.version,
            input.notice.hash,
            version,
            input.acceptanceId,
            input.presentationId,
          ],
        );
        await this.audit(
          client,
          input.targetId,
          "RADAR_CONSENT_GRANTED",
          "ConsentGrant",
          id,
        );
        return { id, version };
      },
    );
  }

  async revoke(raw: unknown): Promise<string> {
    const input = revokeInput.parse(raw);
    const id = randomUUID();
    await this.guarded(
      {
        actorId: input.targetId,
        action: "RADAR_CONSENT_REVOKE",
        objectType: "ConsentGrant",
        objectId: input.grantId,
      },
      async (client) => {
        const grant = await client.query<Row>(
          `SELECT id FROM "ConsentGrant" WHERE id=$1 AND "subjectId"=$2 AND purpose='BE_PREDICTED' FOR UPDATE`,
          [input.grantId, input.targetId],
        );
        if (!grant.rowCount) throw new RadarInvariantError("GRANT_MISSING");
        await client.query(
          `INSERT INTO "ConsentRevocation" (id,"grantId","subjectId","revokedAt") VALUES ($1,$2,$3,clock_timestamp())`,
          [id, input.grantId, input.targetId],
        );
        await this.audit(
          client,
          input.targetId,
          "RADAR_CONSENT_REVOKED",
          "ConsentGrant",
          input.grantId,
        );
      },
    );
    return id;
  }

  private async activeGrant(
    client: PoolClient,
    grantId: string,
    targetId: string,
    predictorId: string,
  ): Promise<{
    version: number;
    invitedAt: Date;
    acceptedAt: Date;
    grantedAt: Date;
  }> {
    const found = await client.query<{
      consentVersion: number;
      invitedAt: Date;
      acceptedAt: Date;
      grantedAt: Date;
    }>(
      `SELECT g."consentVersion",i."invitedAt",a."acceptedAt",g."grantedAt" FROM "ConsentGrant" g
       JOIN "RadarInvitationAcceptance" a ON a.id=g."invitationAcceptanceId"
       JOIN "RadarInvitation" i ON i.id=a."invitationId"
       JOIN "User" u ON u.id=g."subjectId"
       WHERE g.id=$1 AND g."subjectId"=$2 AND i."predictorId"=$3 AND g.purpose='BE_PREDICTED'
         AND u.status='ACTIVE'
       FOR UPDATE OF g`,
      [grantId, targetId, predictorId],
    );
    if (!found.rows[0]) throw new RadarInvariantError("CONSENT_INACTIVE");
    const revoked = await client.query(
      `SELECT 1 FROM "ConsentRevocation" WHERE "grantId"=$1`,
      [grantId],
    );
    if (revoked.rowCount) throw new RadarInvariantError("CONSENT_INACTIVE");
    return { ...found.rows[0], version: found.rows[0].consentVersion };
  }

  private async activeAnswerConsents(
    client: PoolClient,
    targetAnswerId: string,
    selfAnswerId: string,
    targetId: string,
    predictorId: string,
  ): Promise<void> {
    const found = await client.query<{ id: string; subjectId: string; grantId: string; purpose: string; revoked: boolean }>(
      `SELECT a.id,a."subjectId",g.id AS "grantId",g.purpose,
              EXISTS(SELECT 1 FROM "ConsentRevocation" r WHERE r."grantId"=g.id) AS revoked
       FROM "AnswerVersion" a JOIN "ConsentGrant" g ON g.id=a."consentGrantId"
       WHERE (a.id=$1 AND a."subjectId"=$3) OR (a.id=$2 AND a."subjectId"=$4)`,
      [targetAnswerId, selfAnswerId, targetId, predictorId],
    );
    if (found.rows.length !== 2 || found.rows.some((row) => row.purpose !== "SELF_ANSWER" || row.revoked))
      throw new RadarInvariantError("ANSWER_CONSENT_INACTIVE");
    const grantIds = found.rows.map((row) => row.grantId).sort();
    await client.query(`SELECT id FROM "ConsentGrant" WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [grantIds]);
    const revoked = await client.query(`SELECT 1 FROM "ConsentRevocation" WHERE "grantId"=ANY($1::uuid[])`, [grantIds]);
    if (revoked.rowCount) throw new RadarInvariantError("ANSWER_CONSENT_INACTIVE");
  }

  async submit(raw: unknown): Promise<{ id: string; consentVersion: number }> {
    const input = predictionInput.parse(raw);
    const id = randomUUID();
    return this.guarded(
      {
        actorId: input.predictorId,
        action: "RADAR_PREDICTION",
        objectType: "SocialPredictionSnapshot",
        objectId: id,
      },
      async (client) => {
        const grant = await this.activeGrant(
          client,
          input.grantId,
          input.targetId,
          input.predictorId,
        );
        const optionCount = await client.query<{ count: number }>(
          `SELECT COUNT(*)::integer AS count FROM "AnswerOption" WHERE "questionVersionId"=$1`,
          [input.questionVersionId],
        );
        const probabilityTotal = input.probabilityVector.reduce((sum, value) => sum + value, 0);
        if (
          input.probabilityVector.length !== optionCount.rows[0]?.count ||
          Math.abs(probabilityTotal - 1) > 1e-9
        ) throw new RadarInvariantError("INVALID_PROBABILITY_VECTOR");
        const targetAnswer = (
          await client.query<{ id: string; answeredAt: Date }>(
            `SELECT a.id,a."answeredAt" FROM "AnswerVersion" a JOIN "QuestionVersion" qv ON qv.id=a."questionVersionId" JOIN "Question" q ON q.id=qv."questionId" WHERE a."subjectId"=$1 AND a."questionVersionId"=$2 AND q.domain='RADAR' ORDER BY a.version DESC LIMIT 1`,
            [input.targetId, input.questionVersionId],
          )
        ).rows[0];
        const selfAnswer = (
          await client.query<{ id: string; answeredAt: Date }>(
            `SELECT id,"answeredAt" FROM "AnswerVersion" WHERE id=$1 AND "subjectId"=$2 AND "questionVersionId"=$3`,
            [
              input.selfAnswerVersionId,
              input.predictorId,
              input.questionVersionId,
            ],
          )
        ).rows[0];
        if (!targetAnswer || !selfAnswer)
          throw new RadarInvariantError("ANSWER_MISSING");
        await this.activeAnswerConsents(client, targetAnswer.id, selfAnswer.id, input.targetId, input.predictorId);
        const now = await client.query<{ now: Date }>(
          `SELECT clock_timestamp() AS now`,
        );
        const predictedAt = now.rows[0]!.now;
        if (
          !isRadarOrderValid({
            invitedAt: grant.invitedAt,
            acceptedAt: grant.acceptedAt,
            grantedAt: grant.grantedAt,
            answeredAt: targetAnswer.answeredAt,
            predictedAt,
          }) ||
          selfAnswer.answeredAt >= predictedAt
        )
          throw new RadarInvariantError("TEMPORAL_ORDER");
        const snapshotHash = createHash("sha256")
          .update(
            JSON.stringify({
              id,
              ...input,
              answerVersionId: targetAnswer.id,
              consentVersion: grant.version,
              predictedAt: predictedAt.toISOString(),
            }),
          )
          .digest("hex");
        await client.query(
          `INSERT INTO "SocialPredictionSnapshot" (id,"predictorId","targetId","questionVersionId","answerVersionId","selfAnswerVersionId","targetConsentGrantId","targetConsentVersion","probabilityVector","supersedesId","predictedAt","snapshotHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
          [
            id,
            input.predictorId,
            input.targetId,
            input.questionVersionId,
            targetAnswer.id,
            input.selfAnswerVersionId,
            input.grantId,
            grant.version,
            JSON.stringify(input.probabilityVector),
            input.supersedesId ?? null,
            predictedAt,
            snapshotHash,
          ],
        );
        return { id, consentVersion: grant.version };
      },
    );
  }

  // Eligibility only. No score, consensus, metric, or result is calculated.
  async assertEvaluationEligible(
    snapshotId: string,
    predictorId: string,
  ): Promise<void> {
    uuid.parse(snapshotId);
    uuid.parse(predictorId);
    await this.guarded(
      {
        actorId: predictorId,
        action: "RADAR_EVALUATION",
        objectType: "SocialPredictionSnapshot",
        objectId: snapshotId,
      },
      async (client) => {
        const snapshot = await client.query<{
          targetConsentGrantId: string;
          targetId: string;
          answerVersionId: string;
          selfAnswerVersionId: string;
        }>(
          `SELECT "targetConsentGrantId","targetId","answerVersionId","selfAnswerVersionId" FROM "SocialPredictionSnapshot" WHERE id=$1 AND "predictorId"=$2`,
          [snapshotId, predictorId],
        );
        if (!snapshot.rows[0])
          throw new RadarInvariantError("SNAPSHOT_MISSING");
        await this.activeGrant(
          client,
          snapshot.rows[0].targetConsentGrantId,
          snapshot.rows[0].targetId,
          predictorId,
        );
        await this.activeAnswerConsents(client, snapshot.rows[0].answerVersionId, snapshot.rows[0].selfAnswerVersionId, snapshot.rows[0].targetId, predictorId);
      },
    );
  }
}

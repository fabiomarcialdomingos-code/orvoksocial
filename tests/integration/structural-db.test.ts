import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("Fase 1: estrutura PostgreSQL", () => {
  const db = new Client({ connectionString: databaseUrl });

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  it("mantém enum oficial, FKs compostas e registros históricos imutáveis", async () => {
    const states = await db.query<{ enumlabel: string }>(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
       WHERE t.typname='EvidenceState' ORDER BY e.enumsortorder`,
    );
    expect(states.rows.map((row) => row.enumlabel)).toEqual([
      "INITIAL",
      "EVALUATION",
      "SUFFICIENT",
    ]);

    const [predictorId, targetId, questionId, versionId, otherVersionId] =
      Array.from({ length: 5 }, () => randomUUID());
    const [
      optionId,
      secondOptionId,
      wrongOptionId,
      targetGrantId,
      selfGrantId,
      targetSelfGrantId,
    ] = Array.from({ length: 6 }, () => randomUUID());
    const [targetAnswerId, selfAnswerId, socialSnapshotId, revocationId] =
      Array.from({ length: 4 }, () => randomUUID());
    const [invitationId, acceptanceId] = [randomUUID(), randomUUID()];
    const hash = "a".repeat(64);
    const adminId = randomUUID();
    const [predictorSession, targetSession, selfNoticeId, radarNoticeId, predictorPresentationId, targetPresentationId, radarPresentationId] = Array.from({ length: 7 }, () => randomUUID());
    const noticeContent = "FIXTURE NOTICE ONLY";
    const noticeHash = createHash("sha256").update(noticeContent).digest("hex");

    async function expectRejected(sql: string, params: unknown[]) {
      await db.query("SAVEPOINT expected_rejection");
      let rejected = false;
      try {
        await db.query(sql, params);
      } catch {
        rejected = true;
      } finally {
        await db.query("ROLLBACK TO SAVEPOINT expected_rejection");
        await db.query("RELEASE SAVEPOINT expected_rejection");
      }
      expect(rejected).toBe(true);
    }

    await db.query("BEGIN");
    try {
      await db.query(
        `INSERT INTO "User" (id,"updatedAt") VALUES ($1,now()),($2,now())`,
        [predictorId, targetId],
      );
      await db.query(`INSERT INTO "User" (id,role,"updatedAt") VALUES ($1,'ADMIN',clock_timestamp())`, [adminId]);
      await db.query(`INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt") VALUES ($1,$2,$3,$4,clock_timestamp()+interval '1 hour'),($5,$6,$7,$8,clock_timestamp()+interval '1 hour')`, [predictorSession, predictorId, "1".repeat(64), randomUUID(), targetSession, targetId, "2".repeat(64), randomUUID()]);
      await db.query(
        `INSERT INTO "ConsentNotice" (id,purpose,version,content,"contentHash",status,"approvedAt","approvedById","testOnly") VALUES ($1,'SELF_ANSWER','fixture',$3,$4,'APPROVED',clock_timestamp(),$5,true),($2,'BE_PREDICTED','fixture',$3,$4,'APPROVED',clock_timestamp(),$5,true)`,
        [selfNoticeId, radarNoticeId, noticeContent, noticeHash, adminId],
      );
      await db.query(`INSERT INTO "ConsentNoticePresentation" (id,"userId","noticeId","sessionId","presentedAt") VALUES ($1,$2,$3,$4,clock_timestamp()),($5,$6,$3,$7,clock_timestamp())`, [predictorPresentationId, predictorId, selfNoticeId, predictorSession, targetPresentationId, targetId, targetSession]);
      await db.query(
        `INSERT INTO "Question" (id,"stableKey",domain) VALUES ($1,$2,'RADAR')`,
        [questionId, `FIXTURE_ONLY_${questionId}`],
      );
      await db.query(
        `INSERT INTO "QuestionVersion" (id,"questionId",version,text,"familyKey","contentHash")
         VALUES ($1,$3,1,'fixture v1','fixture',$4),($2,$3,2,'fixture v2','fixture',$4)`,
        [versionId, otherVersionId, questionId, hash],
      );
      await db.query(
        `INSERT INTO "AnswerOption" (id,"questionVersionId",code,label,position)
         VALUES ($1,$4,'A','fixture A',0),($2,$4,'B','fixture B',1),($3,$5,'B','fixture B',0)`,
        [optionId, secondOptionId, wrongOptionId, versionId, otherVersionId],
      );
      await db.query(
        `INSERT INTO "RadarInvitation" (id,"predictorId","targetId","invitedAt") VALUES ($1,$2,$3,clock_timestamp())`,
        [invitationId, predictorId, targetId],
      );
      await expectRejected(
        `INSERT INTO "RadarInvitationAcceptance" (id,"invitationId","targetId","acceptedAt") VALUES ($1,$2,$3,'2000-01-01'::timestamptz)`,
        [randomUUID(), invitationId, targetId],
      );
      await db.query(
        `INSERT INTO "RadarInvitationAcceptance" (id,"invitationId","targetId","acceptedAt") VALUES ($1,$2,$3,clock_timestamp())`,
        [acceptanceId, invitationId, targetId],
      );
      await db.query(`INSERT INTO "ConsentNoticePresentation" (id,"userId","noticeId","sessionId","invitationAcceptanceId","presentedAt") VALUES ($1,$2,$3,$4,$5,clock_timestamp())`, [radarPresentationId, targetId, radarNoticeId, targetSession, acceptanceId]);
      await db.query(
        `INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","noticePresentationId","grantedAt")
         VALUES ($1,$3,'SELF_ANSWER','PRIVATE','fixture',$5,$6,clock_timestamp()),
                ($2,$4,'SELF_ANSWER','PRIVATE','fixture',$5,$7,clock_timestamp())`,
        [selfGrantId, targetSelfGrantId, predictorId, targetId, noticeHash, predictorPresentationId, targetPresentationId],
      );
      await db.query(
        `INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","invitationAcceptanceId","noticePresentationId","grantedAt")
         VALUES ($1,$2,'BE_PREDICTED','SHARED','fixture',$3,$4,$5,clock_timestamp())`,
        [targetGrantId, targetId, noticeHash, acceptanceId, radarPresentationId],
      );
      await expectRejected(
        `INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","invitationAcceptanceId","noticePresentationId","consentVersion","grantedAt") VALUES ($1,$2,'BE_PREDICTED','SHARED','fixture',$3,$4,$5,2,clock_timestamp())`,
        [randomUUID(), targetId, noticeHash, acceptanceId, targetPresentationId],
      );
      await expectRejected(
        `INSERT INTO "ConsentNotice" (id,purpose,version,content,"contentHash",status,"approvedAt","approvedById") VALUES ($1,'BE_PREDICTED','bad-fixture','mismatch',$2,'APPROVED',clock_timestamp(),$3)`,
        [randomUUID(), noticeHash, adminId],
      );
      await expectRejected(
        `INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","grantedAt") VALUES ($1,$2,'BE_PREDICTED','SHARED','fixture',$3,clock_timestamp())`,
        [randomUUID(), targetId, noticeHash],
      );
      await db.query(
        `INSERT INTO "AnswerVersion"
         (id,"subjectId","questionVersionId","optionId","consentGrantId",version,"answeredAt","snapshotHash")
         VALUES ($1,$3,$5,$6,$7,1,clock_timestamp(),$9),($2,$4,$5,$6,$8,1,clock_timestamp(),$9)`,
        [
          selfAnswerId,
          targetAnswerId,
          predictorId,
          targetId,
          versionId,
          optionId,
          selfGrantId,
          targetSelfGrantId,
          hash,
        ],
      );

      await expectRejected(
        `INSERT INTO "AnswerVersion"
         (id,"subjectId","questionVersionId","optionId","consentGrantId",version,"answeredAt","snapshotHash")
         VALUES ($1,$2,$3,$4,$5,2,now(),$6)`,
        [
          randomUUID(),
          targetId,
          versionId,
          wrongOptionId,
          targetSelfGrantId,
          hash,
        ],
      );
      await expectRejected(
        `UPDATE "AnswerVersion" SET "snapshotHash"=$2 WHERE id=$1`,
        [targetAnswerId, "b".repeat(64)],
      );
      await expectRejected(
        `INSERT INTO "ConsentRevocation" (id,"grantId","subjectId","revokedAt") VALUES ($1,$2,$3,now())`,
        [randomUUID(), targetGrantId, predictorId],
      );

      await expectRejected(
        `INSERT INTO "SocialPredictionSnapshot"
         (id,"predictorId","targetId","questionVersionId","answerVersionId","selfAnswerVersionId","targetConsentGrantId","targetConsentVersion","probabilityVector","predictedAt","snapshotHash")
         VALUES ($1,$2,$3,$4,$5,$6,$7,1,'[0.7,0.3]'::jsonb,clock_timestamp(),$8)`,
        [
          randomUUID(),
          predictorId,
          targetId,
          versionId,
          selfAnswerId,
          selfAnswerId,
          targetGrantId,
          hash,
        ],
      );
      await expectRejected(
        `INSERT INTO "SocialPredictionSnapshot"
         (id,"predictorId","targetId","questionVersionId","answerVersionId","selfAnswerVersionId","targetConsentGrantId","targetConsentVersion","probabilityVector","predictedAt","snapshotHash")
         VALUES ($1,$2,$3,$4,$5,$6,$7,1,'[0.7,0.3]'::jsonb,'2000-01-01'::timestamptz,$8)`,
        [
          randomUUID(),
          predictorId,
          targetId,
          versionId,
          targetAnswerId,
          selfAnswerId,
          targetGrantId,
          hash,
        ],
      );
      await db.query(
        `INSERT INTO "SocialPredictionSnapshot"
         (id,"predictorId","targetId","questionVersionId","answerVersionId","selfAnswerVersionId","targetConsentGrantId","targetConsentVersion","probabilityVector","predictedAt","snapshotHash")
         VALUES ($1,$2,$3,$4,$5,$6,$7,1,'[0.7,0.3]'::jsonb,clock_timestamp(),$8)`,
        [
          socialSnapshotId,
          predictorId,
          targetId,
          versionId,
          targetAnswerId,
          selfAnswerId,
          targetGrantId,
          hash,
        ],
      );
      await expectRejected(
        `UPDATE "SocialPredictionSnapshot" SET "snapshotHash"=$2 WHERE id=$1`,
        [socialSnapshotId, "b".repeat(64)],
      );
      await db.query(
        `INSERT INTO "ConsentRevocation" (id,"grantId","subjectId","revokedAt") VALUES ($1,$2,$3,clock_timestamp())`,
        [revocationId, targetGrantId, targetId],
      );
      await expectRejected(
        `INSERT INTO "ConsentRevocation" (id,"grantId","subjectId","revokedAt") VALUES ($1,$2,$3,clock_timestamp())`,
        [randomUUID(), targetGrantId, targetId],
      );
      await expectRejected(
        `INSERT INTO "SocialPredictionSnapshot"
         (id,"predictorId","targetId","questionVersionId","answerVersionId","selfAnswerVersionId","targetConsentGrantId","targetConsentVersion","probabilityVector","predictedAt","snapshotHash")
         VALUES ($1,$2,$3,$4,$5,$6,$7,1,'[0.7,0.3]'::jsonb,clock_timestamp(),$8)`,
        [
          randomUUID(),
          predictorId,
          targetId,
          versionId,
          targetAnswerId,
          selfAnswerId,
          targetGrantId,
          hash,
        ],
      );
    } finally {
      await db.query("ROLLBACK");
    }
  });
});

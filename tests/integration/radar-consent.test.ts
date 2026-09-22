import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { RadarConsentService } from "../../src/lib/radar-consent";

const url = process.env.DATABASE_URL;
describe.skipIf(!url)(
  "consentimento Radar e temporalidade no PostgreSQL",
  () => {
    const pool = new Pool({ connectionString: url, max: 4 });
    const service = new RadarConsentService(pool);
    const ids = {
      predictor: randomUUID(),
      target: randomUUID(),
      question: randomUUID(),
      version: randomUUID(),
      option: randomUUID(),
      secondOption: randomUUID(),
      selfGrant: randomUUID(),
      targetSelfGrant: randomUUID(),
      selfAnswer: randomUUID(),
      targetAnswer: randomUUID(),
      admin: randomUUID(),
      noticeSelf: randomUUID(),
      noticeRadar: randomUUID(),
      predictorSession: randomUUID(),
      targetSession: randomUUID(),
      predictorTokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
      targetTokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
      predictorPresentation: randomUUID(),
      targetPresentation: randomUUID(),
      radarPresentation: randomUUID(),
      radarPresentationRenewal: randomUUID(),
    };
    const hash = "a".repeat(64);
    const noticeContent = "FIXTURE NOTICE ONLY";
    const noticeVersion = `FIXTURE-${randomUUID()}`;
    const noticeHash = createHash("sha256").update(noticeContent).digest("hex");
    const snapshotIds: string[] = [];
    const invitationIds: string[] = [];
    const grantIds: string[] = [];

    beforeAll(async () => {
      await pool.query(
        `INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp()),($2,clock_timestamp())`,
        [ids.predictor, ids.target],
      );
      await pool.query(`INSERT INTO "User" (id,role,"updatedAt") VALUES ($1,'ADMIN',clock_timestamp())`, [ids.admin]);
      await pool.query(`INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt") VALUES ($1,$2,$3,$4,clock_timestamp()+interval '1 hour'),($5,$6,$7,$8,clock_timestamp()+interval '1 hour')`, [ids.predictorSession, ids.predictor, ids.predictorTokenHash, randomUUID(), ids.targetSession, ids.target, ids.targetTokenHash, randomUUID()]);
      await pool.query(
        `INSERT INTO "ConsentNotice" (id,purpose,version,content,"contentHash",status,"approvedAt","approvedById","testOnly") VALUES ($1,'SELF_ANSWER',$6,$3,$4,'APPROVED',clock_timestamp(),$5,true),($2,'BE_PREDICTED',$6,$3,$4,'APPROVED',clock_timestamp(),$5,true)`,
        [ids.noticeSelf, ids.noticeRadar, noticeContent, noticeHash, ids.admin, noticeVersion],
      );
      await pool.query(`INSERT INTO "ConsentNoticePresentation" (id,"userId","noticeId","sessionId","presentedAt") VALUES ($1,$2,$3,$4,clock_timestamp()),($5,$6,$3,$7,clock_timestamp())`, [ids.predictorPresentation, ids.predictor, ids.noticeSelf, ids.predictorSession, ids.targetPresentation, ids.target, ids.targetSession]);
      await pool.query(
        `INSERT INTO "Question" (id,"stableKey",domain) VALUES ($1,$2,'RADAR')`,
        [ids.question, `FIXTURE_ONLY_${ids.question}`],
      );
      await pool.query(
        `INSERT INTO "QuestionVersion" (id,"questionId",version,text,"familyKey","contentHash") VALUES ($1,$2,1,'FIXTURE ONLY','fixture',$3)`,
        [ids.version, ids.question, hash],
      );
      await pool.query(
        `INSERT INTO "AnswerOption" (id,"questionVersionId",code,label,position) VALUES ($1,$3,'A','FIXTURE ONLY',0),($2,$3,'B','FIXTURE ONLY',1)`,
        [ids.option, ids.secondOption, ids.version],
      );
      await pool.query(
        `INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","noticePresentationId","grantedAt") VALUES ($1,$3,'SELF_ANSWER','PRIVATE',$8,$5,$6,clock_timestamp()),($2,$4,'SELF_ANSWER','PRIVATE',$8,$5,$7,clock_timestamp())`,
        [ids.selfGrant, ids.targetSelfGrant, ids.predictor, ids.target, noticeHash, ids.predictorPresentation, ids.targetPresentation, noticeVersion],
      );
    });
    afterAll(async () => {
      // Only fixture IDs created here are removed; no real catalog data is touched.
      await pool.query(`DELETE FROM "Notification" WHERE "recipientId"=ANY($1::uuid[])`, [[ids.predictor, ids.target]]);
      await pool.query(
        `DELETE FROM "AuditLog" WHERE "actorId"=ANY($1::uuid[])`,
        [[ids.predictor, ids.target]],
      );
      await pool.query(
        `DELETE FROM "SocialPredictionSnapshot" WHERE id=ANY($1::uuid[])`,
        [snapshotIds],
      );
      await pool.query(`DELETE FROM "AnswerVersion" WHERE id=ANY($1::uuid[])`, [
        [ids.selfAnswer, ids.targetAnswer],
      ]);
      await pool.query(
        `DELETE FROM "ConsentRevocation" WHERE "grantId"=ANY($1::uuid[])`,
        [grantIds],
      );
      await pool.query(`DELETE FROM "ConsentGrant" WHERE id=ANY($1::uuid[])`, [
        [...grantIds, ids.selfGrant, ids.targetSelfGrant],
      ]);
      await pool.query(`DELETE FROM "ConsentNoticePresentation" WHERE id=ANY($1::uuid[])`, [[ids.predictorPresentation, ids.targetPresentation, ids.radarPresentation, ids.radarPresentationRenewal]]);
      await pool.query(
        `DELETE FROM "RadarInvitationAcceptance" WHERE "invitationId"=ANY($1::uuid[])`,
        [invitationIds],
      );
      await pool.query(
        `DELETE FROM "RadarInvitation" WHERE id=ANY($1::uuid[])`,
        [invitationIds],
      );
      await pool.query(`DELETE FROM "AnswerOption" WHERE id=ANY($1::uuid[])`, [[ids.option, ids.secondOption]]);
      await pool.query(`DELETE FROM "QuestionVersion" WHERE id=$1`, [
        ids.version,
      ]);
      await pool.query(`DELETE FROM "Question" WHERE id=$1`, [ids.question]);
      await pool.query(`DELETE FROM "ConsentNotice" WHERE id=ANY($1::uuid[])`, [[ids.noticeSelf, ids.noticeRadar]]);
      await pool.query(`DELETE FROM "AuthSession" WHERE id=ANY($1::uuid[])`, [[ids.predictorSession, ids.targetSession]]);
      await pool.query(`DELETE FROM "User" WHERE id=ANY($1::uuid[])`, [
        [ids.predictor, ids.target, ids.admin],
      ]);
      await pool.end();
    });

    it("rejeita convite não aceito e registra a tentativa bloqueada", async () => {
      const invitation = await service.invite({
        predictorId: ids.predictor,
        targetId: ids.target,
      });
      invitationIds.push(invitation);
      await expect(
        service.grant({
          acceptanceId: randomUUID(),
          targetId: ids.target,
          notice: { version: noticeVersion, hash: noticeHash },
          presentationId: ids.radarPresentation,
          sessionId: ids.targetSession,
          scope: "SHARED",
        }),
      ).rejects.toMatchObject({ code: "ACCEPTANCE_MISSING" });
      await expect(
        service.submit({
          predictorId: ids.predictor,
          targetId: ids.target,
          questionVersionId: ids.version,
          selfAnswerVersionId: ids.selfAnswer,
          grantId: randomUUID(),
          probabilityVector: [0.5, 0.5],
        }),
      ).rejects.toMatchObject({ code: "CONSENT_INACTIVE" });
      const audit = await pool.query<{ action: string }>(
        `SELECT action FROM "AuditLog" WHERE "actorId"=ANY($1::uuid[]) AND action LIKE '%BLOCKED%'`,
        [[ids.predictor, ids.target]],
      );
      expect(audit.rows.map((r) => r.action)).toEqual(
        expect.arrayContaining([
          "RADAR_CONSENT_GRANT_BLOCKED_ACCEPTANCE_MISSING",
          "RADAR_PREDICTION_BLOCKED_CONSENT_INACTIVE",
        ]),
      );
    });

    it("aceita ordem válida, fixa a versão e bloqueia avaliação após revogação", async () => {
      const invitation = invitationIds[0]!;
      const acceptance = await service.accept({
        invitationId: invitation,
        targetId: ids.target,
      });
      await pool.query(`INSERT INTO "ConsentNoticePresentation" (id,"userId","noticeId","sessionId","invitationAcceptanceId","presentedAt") VALUES ($1,$2,$3,$4,$5,clock_timestamp())`, [ids.radarPresentation, ids.target, ids.noticeRadar, ids.targetSession, acceptance]);
      const grant = await service.grant({
        acceptanceId: acceptance,
        targetId: ids.target,
        notice: { version: noticeVersion, hash: noticeHash },
        presentationId: ids.radarPresentation,
        sessionId: ids.targetSession,
        scope: "SHARED",
      });
      grantIds.push(grant.id);
      await expect(service.grant({
        acceptanceId: acceptance,
        targetId: ids.target,
        notice: { version: noticeVersion, hash: noticeHash },
        presentationId: ids.radarPresentation,
        sessionId: ids.targetSession,
        scope: "SHARED",
      })).rejects.toMatchObject({ code: "CONSENT_ALREADY_ACTIVE" });
      await expect(pool.query(
        `INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","consentVersion","invitationAcceptanceId","noticePresentationId","grantedAt") VALUES ($1,$2,'BE_PREDICTED','SHARED',$3,$4,$5,$6,$7,clock_timestamp())`,
        [randomUUID(), ids.target, noticeVersion, noticeHash, grant.version + 1, acceptance, ids.radarPresentation],
      )).rejects.toMatchObject({ code: "23505" });
      const auditGrant = await pool.query(
        `SELECT 1 FROM "AuditLog" WHERE action='RADAR_CONSENT_GRANTED' AND "objectId"=$1`,
        [grant.id],
      );
      expect(auditGrant.rowCount).toBe(1);
      await pool.query(
        `INSERT INTO "AnswerVersion" (id,"subjectId","questionVersionId","optionId","consentGrantId",version,"answeredAt","snapshotHash") VALUES ($1,$3,$5,$6,$7,1,clock_timestamp(),$9),($2,$4,$5,$6,$8,1,clock_timestamp(),$9)`,
        [
          ids.selfAnswer,
          ids.targetAnswer,
          ids.predictor,
          ids.target,
          ids.version,
          ids.option,
          ids.selfGrant,
          ids.targetSelfGrant,
          hash,
        ],
      );
      const input = {
        predictorId: ids.predictor,
        targetId: ids.target,
        questionVersionId: ids.version,
        selfAnswerVersionId: ids.selfAnswer,
        grantId: grant.id,
        probabilityVector: [0.7, 0.3],
      };
      const snapshot = await service.submit(input);
      snapshotIds.push(snapshot.id);
      expect(snapshot.consentVersion).toBe(grant.version);
      const stored = await pool.query<{
        targetConsentVersion: number;
        targetConsentGrantId: string;
      }>(
        `SELECT "targetConsentVersion","targetConsentGrantId" FROM "SocialPredictionSnapshot" WHERE id=$1`,
        [snapshot.id],
      );
      expect(stored.rows[0]).toMatchObject({
        targetConsentVersion: grant.version,
        targetConsentGrantId: grant.id,
      });
      await service.assertEvaluationEligible(snapshot.id, ids.predictor);
      await expect(
        pool.query(
          `UPDATE "SocialPredictionSnapshot" SET "snapshotHash"=$2 WHERE id=$1`,
          [snapshot.id, "b".repeat(64)],
        ),
      ).rejects.toThrow();
      await service.revoke({ grantId: grant.id, targetId: ids.target });
      await expect(service.submit(input)).rejects.toMatchObject({
        code: "CONSENT_INACTIVE",
      });
      await expect(
        service.assertEvaluationEligible(snapshot.id, ids.predictor),
      ).rejects.toMatchObject({ code: "CONSENT_INACTIVE" });
      const actions = await pool.query<{ action: string }>(
        `SELECT action FROM "AuditLog" WHERE "objectId"=$1`,
        [grant.id],
      );
      expect(actions.rows.map((r) => r.action)).toEqual(
        expect.arrayContaining([
          "RADAR_CONSENT_GRANTED",
          "RADAR_CONSENT_REVOKED",
        ]),
      );
      await pool.query(`INSERT INTO "ConsentNoticePresentation" (id,"userId","noticeId","sessionId","invitationAcceptanceId","presentedAt") VALUES ($1,$2,$3,$4,$5,clock_timestamp())`, [ids.radarPresentationRenewal, ids.target, ids.noticeRadar, ids.targetSession, acceptance]);
      const newGrant = await service.grant({
        acceptanceId: acceptance,
        targetId: ids.target,
        notice: { version: noticeVersion, hash: noticeHash },
        presentationId: ids.radarPresentationRenewal,
        sessionId: ids.targetSession,
        scope: "PRIVATE",
      });
      grantIds.push(newGrant.id);
      expect(newGrant.version).toBe(grant.version + 1);
      await expect(
        service.assertEvaluationEligible(snapshot.id, ids.predictor),
      ).rejects.toMatchObject({ code: "CONSENT_INACTIVE" });
      const unchanged = await pool.query<{ targetConsentVersion: number }>(
        `SELECT "targetConsentVersion" FROM "SocialPredictionSnapshot" WHERE id=$1`,
        [snapshot.id],
      );
      expect(unchanged.rows[0]?.targetConsentVersion).toBe(grant.version);
    });

    it("barreira SQL rejeita previsão com grant revogado ou versão errada", async () => {
      const grant = grantIds[0]!;
      const direct = async (version: number) =>
        pool.query(
          `INSERT INTO "SocialPredictionSnapshot" (id,"predictorId","targetId","questionVersionId","answerVersionId","selfAnswerVersionId","targetConsentGrantId","targetConsentVersion","probabilityVector","predictedAt","snapshotHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'[0.5,0.5]'::jsonb,clock_timestamp(),$9)`,
          [
            randomUUID(),
            ids.predictor,
            ids.target,
            ids.version,
            ids.targetAnswer,
            ids.selfAnswer,
            grant,
            version,
            hash,
          ],
        );
      await expect(direct(1)).rejects.toThrow();
      await expect(direct(2)).rejects.toThrow();
      const blocked = await pool.query<{ action: string }>(
        `SELECT action FROM "AuditLog" WHERE action LIKE 'RADAR_%BLOCKED_%' AND "actorId"=$1`,
        [ids.predictor],
      );
      expect(blocked.rows.map((r) => r.action)).toContain(
        "RADAR_EVALUATION_BLOCKED_CONSENT_INACTIVE",
      );
    });
  },
);

import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";

loadEnv({ path: ".env.local", override: false, quiet: true });
if (process.env.APP_ENV !== "test" && process.env.APP_ENV !== "development")
  throw new Error("RADAR_HARDENING_LOCAL_OR_CI_ONLY");
const ownerUrl = process.env.DATABASE_URL;
const appUrl = process.env.APP_DATABASE_URL;
if (!ownerUrl || !appUrl || !/(_dev|_test)$/.test(decodeURIComponent(new URL(ownerUrl).pathname.slice(1))))
  throw new Error("TEST_DATABASE_AND_RUNTIME_ROLE_REQUIRED");
const owner = new Pool({ connectionString: ownerUrl });
const app = new Pool({ connectionString: appUrl });
const predictor = randomUUID();
const target = randomUUID();
const predictorHash = randomBytes(32).toString("hex");
const targetHash = randomBytes(32).toString("hex");
const ids = {
  question: randomUUID(), version: randomUUID(), optionA: randomUUID(), optionB: randomUUID(),
  predictorSession: randomUUID(), targetSession: randomUUID(),
  inviteA: randomUUID(), inviteB: randomUUID(), acceptA: randomUUID(), acceptB: randomUUID(),
};
let presentationId: string | undefined;
let created = false;
let gateWasEnabled = false;
try {
  const control = await owner.query<{ allowTestOnly: boolean }>(`SELECT "allowTestOnly" FROM "RadarCatalogControl" WHERE id=1`);
  gateWasEnabled = control.rows[0]?.allowTestOnly === true;
  if (!gateWasEnabled) throw new Error("TEST_ONLY_GATE_MUST_START_ENABLED");
  const fixture = await owner.query<{ id: string }>(
    `SELECT id FROM "QuestionVersion" WHERE "catalogStatus"='TEST_ONLY' ORDER BY id LIMIT 1`,
  );
  if (!fixture.rows[0]) throw new Error("TEST_ONLY_QUESTION_REQUIRED");
  const testVersionId = fixture.rows[0].id;
  await owner.query(`INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp()),($2,clock_timestamp())`, [predictor,target]);
  created = true;
  await owner.query(`INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt") VALUES
    ($1,$3,'TEST_ONLY',clock_timestamp()),($2,$4,'TEST_ONLY',clock_timestamp())`,
    [predictor,target,`${predictor}@example.test`,`${target}@example.test`]);
  await owner.query(`INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt") VALUES
    ($1,$2,$3,$4,clock_timestamp()+interval '1 hour'),($5,$6,$7,$8,clock_timestamp()+interval '1 hour')`,
    [ids.predictorSession,predictor,predictorHash,randomUUID(),ids.targetSession,target,targetHash,randomUUID()]);
  await owner.query(`INSERT INTO "Question" (id,"stableKey",domain) VALUES ($1,$2,'RADAR')`,
    [ids.question,`TEST_ONLY_AUDIT_${ids.question}`]);
  await owner.query(`INSERT INTO "QuestionVersion" (id,"questionId",version,text,"familyKey","contentHash","instrumentVersion","catalogStatus")
    VALUES ($1,$2,1,'TEST_ONLY candidate audit','TEST_ONLY_AUDIT',$3,'TEST_ONLY_AUDIT_V1','CANDIDATE')`,
    [ids.version,ids.question,"b".repeat(64)]);
  await owner.query(`INSERT INTO "AnswerOption" (id,"questionVersionId",code,label,position) VALUES
    ($1,$3,'A','TEST_ONLY A',0),($2,$3,'B','TEST_ONLY B',1)`, [ids.optionA,ids.optionB,ids.version]);

  const visible = async (questionVersionId: string) => {
    const client = await app.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT orvok_bind_read_actor($1)`, [targetHash]);
      const question = await client.query(`SELECT id FROM "Question" WHERE id=(SELECT "questionId" FROM "QuestionVersion" WHERE id=$1)`, [questionVersionId]);
      const version = await client.query(`SELECT id FROM "QuestionVersion" WHERE id=$1`, [questionVersionId]);
      const options = await client.query(`SELECT id FROM "AnswerOption" WHERE "questionVersionId"=$1`, [questionVersionId]);
      const notices = await client.query(`SELECT id FROM "ConsentNotice" WHERE "testOnly" AND status='APPROVED'`);
      await client.query("COMMIT");
      return { question: question.rowCount ?? 0, version: version.rowCount ?? 0,
        options: options.rowCount ?? 0, notices: notices.rowCount ?? 0 };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  };
  const candidateEnabled = await visible(ids.version);
  const testEnabled = await visible(testVersionId);
  if (candidateEnabled.question !== 0 || candidateEnabled.version !== 0 || candidateEnabled.options !== 0 ||
      testEnabled.version !== 1 || testEnabled.options < 2 || testEnabled.notices < 1)
    throw new Error(`CATALOG_RLS_ENABLED_INVALID:${JSON.stringify({ candidateEnabled,testEnabled })}`);

  await owner.query(`INSERT INTO "RadarInvitation" (id,"predictorId","targetId","invitedAt") VALUES
    ($1,$3,$4,clock_timestamp()),($2,$3,$4,clock_timestamp())`,
    [ids.inviteA,ids.inviteB,predictor,target]);
  await owner.query(`INSERT INTO "RadarInvitationAcceptance" (id,"invitationId","targetId","acceptedAt") VALUES
    ($1,$3,$5,clock_timestamp()),($2,$4,$5,clock_timestamp())`,
    [ids.acceptA,ids.acceptB,ids.inviteA,ids.inviteB,target]);
  const presentation = await app.query<{ presentation_id: string; notice_version: string; notice_hash: string }>(
    `SELECT * FROM orvok_radar_present_notice($1,'BE_PREDICTED'::"ConsentPurpose",$2)`,
    [targetHash,ids.acceptA],
  );
  presentationId = presentation.rows[0]?.presentation_id;
  if (!presentationId) throw new Error("PRESENTATION_A_MISSING");
  try {
    await app.query(`SELECT * FROM orvok_radar_grant($1,$2,$3,'SHARED'::"VisibilityScope",$4,$5)`,
      [targetHash,ids.acceptB,presentationId,presentation.rows[0]!.notice_version,presentation.rows[0]!.notice_hash]);
    throw new Error("PRESENTATION_A_REUSED_FOR_B");
  } catch (error) {
    if ((error as { code?: string }).code !== "23514") throw error;
  }
  const stored = await owner.query<{ invitationAcceptanceId: string }>(
    `SELECT "invitationAcceptanceId" FROM "ConsentNoticePresentation" WHERE id=$1`, [presentationId],
  );
  if (stored.rows[0]?.invitationAcceptanceId !== ids.acceptA)
    throw new Error("PRESENTATION_ACCEPTANCE_NOT_FROZEN");

  await owner.query(`UPDATE "RadarCatalogControl" SET "allowTestOnly"=false,"updatedAt"=clock_timestamp() WHERE id=1`);
  const testDisabled = await visible(testVersionId);
  const candidateDisabled = await visible(ids.version);
  if (testDisabled.question !== 0 || testDisabled.version !== 0 || testDisabled.options !== 0 ||
      testDisabled.notices !== 0 || candidateDisabled.question !== 0 ||
      candidateDisabled.version !== 0 || candidateDisabled.options !== 0)
    throw new Error(`CATALOG_RLS_DISABLED_INVALID:${JSON.stringify({ testDisabled,candidateDisabled })}`);
  console.log("Radar hardening: A/B notice binding and direct runtime RLS passed");
} finally {
  if (gateWasEnabled)
    await owner.query(`UPDATE "RadarCatalogControl" SET "allowTestOnly"=true,"updatedAt"=clock_timestamp() WHERE id=1`);
  if (created) {
    await owner.query(`DELETE FROM "Notification" WHERE "recipientId" IN ($1,$2)`, [predictor,target]);
    await owner.query(`DELETE FROM "AuditLog" WHERE "actorId" IN ($1,$2)`, [predictor,target]);
    if (presentationId) await owner.query(`DELETE FROM "ConsentNoticePresentation" WHERE id=$1`, [presentationId]);
    await owner.query(`DELETE FROM "RadarInvitationAcceptance" WHERE id IN ($1,$2)`, [ids.acceptA,ids.acceptB]);
    await owner.query(`DELETE FROM "RadarInvitation" WHERE id IN ($1,$2)`, [ids.inviteA,ids.inviteB]);
    await owner.query(`DELETE FROM "AnswerOption" WHERE "questionVersionId"=$1`, [ids.version]);
    await owner.query(`DELETE FROM "QuestionVersion" WHERE id=$1`, [ids.version]);
    await owner.query(`DELETE FROM "Question" WHERE id=$1`, [ids.question]);
    await owner.query(`DELETE FROM "AuthSession" WHERE "userId" IN ($1,$2)`, [predictor,target]);
    await owner.query(`DELETE FROM "AuthIdentity" WHERE "userId" IN ($1,$2)`, [predictor,target]);
    await owner.query(`DELETE FROM "User" WHERE id IN ($1,$2)`, [predictor,target]);
  }
  await Promise.all([owner.end(),app.end()]);
}

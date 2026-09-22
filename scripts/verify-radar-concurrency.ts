import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { randomUUID, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";

loadEnv({ path: ".env.local", override: false, quiet: true });
if (process.env.APP_ENV !== "test" && process.env.APP_ENV !== "development")
  throw new Error("RADAR_CONCURRENCY_LOCAL_OR_CI_ONLY");
const ownerUrl = process.env.DATABASE_URL;
const appUrl = process.env.APP_DATABASE_URL;
if (!ownerUrl || !appUrl) throw new Error("DATABASE_URL_AND_APP_DATABASE_URL_REQUIRED");
const owner = new Pool({ connectionString: ownerUrl });
const app = new Pool({ connectionString: appUrl });
const predictor = randomUUID();
const target = randomUUID();
const ids = {
  invitation: randomUUID(), acceptance: randomUUID(),
  predictorSession: randomUUID(), targetSession: randomUUID(),
  predictorPresentation: randomUUID(), targetPresentation: randomUUID(), radarPresentation: randomUUID(),
  predictorSelfGrant: randomUUID(), targetSelfGrant: randomUUID(), radarGrant: randomUUID(),
};
const predictorHash = randomBytes(32).toString("hex");
const targetHash = randomBytes(32).toString("hex");
let created = false;
const lock = await owner.connect();
let pendingPrediction: Promise<unknown> | undefined;
try {
  const fixture = await owner.query<{
    questionId: string; optionA: string; optionB: string;
    selfNoticeId: string; selfVersion: string; selfHash: string;
    radarNoticeId: string; radarVersion: string; radarHash: string;
  }>(`SELECT qv.id AS "questionId",
      (SELECT id FROM "AnswerOption" WHERE "questionVersionId"=qv.id ORDER BY position LIMIT 1) AS "optionA",
      (SELECT id FROM "AnswerOption" WHERE "questionVersionId"=qv.id ORDER BY position OFFSET 1 LIMIT 1) AS "optionB",
      sn.id AS "selfNoticeId",sn.version AS "selfVersion",sn."contentHash" AS "selfHash",
      rn.id AS "radarNoticeId",rn.version AS "radarVersion",rn."contentHash" AS "radarHash"
    FROM "QuestionVersion" qv
    CROSS JOIN LATERAL (SELECT id,version,"contentHash" FROM "ConsentNotice" WHERE purpose='SELF_ANSWER' AND "testOnly" AND status='APPROVED' ORDER BY "approvedAt" DESC LIMIT 1) sn
    CROSS JOIN LATERAL (SELECT id,version,"contentHash" FROM "ConsentNotice" WHERE purpose='BE_PREDICTED' AND "testOnly" AND status='APPROVED' ORDER BY "approvedAt" DESC LIMIT 1) rn
    WHERE qv."catalogStatus"='TEST_ONLY' AND (SELECT COUNT(*) FROM "AnswerOption" WHERE "questionVersionId"=qv.id)=2
    ORDER BY qv.id LIMIT 1`);
  const q = fixture.rows[0];
  if (!q) throw new Error("TEST_ONLY_CATALOG_AND_NOTICES_REQUIRED");

  await owner.query(`INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp()),($2,clock_timestamp())`, [predictor, target]);
  created = true;
  await owner.query(`INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt") VALUES
    ($1,$3,'TEST_ONLY',clock_timestamp()),($2,$4,'TEST_ONLY',clock_timestamp())`,
    [predictor, target, `${predictor}@example.test`, `${target}@example.test`]);
  await owner.query(`INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt") VALUES
    ($1,$2,$3,$4,clock_timestamp()+interval '1 hour'),($5,$6,$7,$8,clock_timestamp()+interval '1 hour')`,
    [ids.predictorSession,predictor,predictorHash,randomUUID(),ids.targetSession,target,targetHash,randomUUID()]);
  await owner.query(`INSERT INTO "RadarInvitation" (id,"predictorId","targetId","invitedAt") VALUES ($1,$2,$3,clock_timestamp())`,
    [ids.invitation,predictor,target]);
  await owner.query(`INSERT INTO "RadarInvitationAcceptance" (id,"invitationId","targetId","acceptedAt") VALUES ($1,$2,$3,clock_timestamp())`,
    [ids.acceptance,ids.invitation,target]);
  await owner.query(`INSERT INTO "ConsentNoticePresentation" (id,"userId","noticeId","sessionId","invitationAcceptanceId","presentedAt") VALUES
    ($1,$4,$6,$9,NULL,clock_timestamp()),($2,$5,$6,$10,NULL,clock_timestamp()),
    ($3,$5,$7,$10,$8,clock_timestamp())`,
    [ids.predictorPresentation,ids.targetPresentation,ids.radarPresentation,predictor,target,
      q.selfNoticeId,q.radarNoticeId,ids.acceptance,ids.predictorSession,ids.targetSession]);
  await owner.query(`INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","noticePresentationId","grantedAt","invitationAcceptanceId") VALUES
    ($1,$4,'SELF_ANSWER','PRIVATE',$6,$7,$9,clock_timestamp(),NULL),
    ($2,$5,'SELF_ANSWER','PRIVATE',$6,$7,$10,clock_timestamp(),NULL),
    ($3,$5,'BE_PREDICTED','SHARED',$8,$11,$12,clock_timestamp(),$13)`,
    [ids.predictorSelfGrant,ids.targetSelfGrant,ids.radarGrant,predictor,target,
      q.selfVersion,q.selfHash,q.radarVersion,ids.predictorPresentation,ids.targetPresentation,
      q.radarHash,ids.radarPresentation,ids.acceptance]);

  const answer = async (hash: string, option: string, grant: string, supersedes: string | null) => {
    const result = await app.query<{ answer_id: string }>(`SELECT * FROM orvok_radar_answer($1,$2,$3,$4,$5)`,
      [hash,q.questionId,option,grant,supersedes]);
    return result.rows[0]!.answer_id;
  };
  const selfAnswerId = await answer(predictorHash,q.optionA,ids.predictorSelfGrant,null);
  const firstTargetAnswer = await answer(targetHash,q.optionA,ids.targetSelfGrant,null);
  const order = await owner.query<{ inviteAccepted: boolean; acceptedGranted: boolean; grantedAnswered: boolean; selfAnswered: boolean; targetActive: boolean }>(
    `SELECT i."invitedAt"<a."acceptedAt" AS "inviteAccepted",
      a."acceptedAt"<g."grantedAt" AS "acceptedGranted",
      g."grantedAt"<av."answeredAt" AS "grantedAnswered",
      EXISTS (SELECT 1 FROM "AnswerVersion" sa WHERE sa."subjectId"=$3
        AND sa."questionVersionId"=av."questionVersionId" AND sa."answeredAt"<clock_timestamp()) AS "selfAnswered",
      EXISTS (SELECT 1 FROM "User" u WHERE u.id=$4 AND u.status='ACTIVE') AS "targetActive"
     FROM "RadarInvitation" i JOIN "RadarInvitationAcceptance" a ON a."invitationId"=i.id
     JOIN "ConsentGrant" g ON g."invitationAcceptanceId"=a.id
     JOIN "AnswerVersion" av ON av.id=$2 WHERE i.id=$1`,
    [ids.invitation,firstTargetAnswer,predictor,target],
  );
  if (!order.rows[0] || Object.values(order.rows[0]).some((value) => !value))
    throw new Error(`FIXTURE_TEMPORAL_ORDER_INVALID:${JSON.stringify(order.rows[0])}`);

  await lock.query("BEGIN");
  await lock.query(`SELECT id FROM "User" WHERE id=$1 FOR UPDATE`, [target]);
  let predictionSettled = false;
  const prediction = app.query<{ snapshot_id: string }>(
    `SELECT * FROM orvok_radar_predict($1,$2,$3,$4,$5,'[0.6,0.4]'::jsonb,NULL)`,
    [predictorHash,target,q.questionId,selfAnswerId,ids.radarGrant],
  ).then(
    (value) => { predictionSettled = true; return { ok: true as const, value }; },
    (error: unknown) => { predictionSettled = true; return { ok: false as const, error }; },
  );
  pendingPrediction = prediction;
  let waitingForLock = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const activity = await owner.query<{ waiting: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_stat_activity
        WHERE usename='orvok_app_runtime' AND query LIKE 'SELECT * FROM orvok_radar_predict%'
          AND wait_event_type='Lock') AS waiting`,
    );
    waitingForLock = activity.rows[0]?.waiting === true;
    if (waitingForLock || predictionSettled) break;
    await delay(50);
  }
  if (!waitingForLock) throw new Error("PREDICTION_NOT_SERIALIZED_WITH_TARGET_ANSWER_LOCK");
  if (predictionSettled) throw new Error("PREDICTION_DID_NOT_WAIT_FOR_TARGET_ANSWER_LOCK");
  const secondAnswer = answer(targetHash,q.optionB,ids.targetSelfGrant,firstTargetAnswer);
  await lock.query("COMMIT");
  const [attempt, latestTargetAnswer] = await Promise.all([prediction, secondAnswer]);
  // If the new answer wins the row lock, rejecting the stale prediction is
  // valid. A fresh attempt must then bind to the new version.
  if (!attempt.ok && (attempt.error as { code?: string }).code !== "23514") throw attempt.error;
  if (!attempt.ok) console.log("Radar concurrency: stale initial prediction rejected as expected");
  const predicted = attempt.ok ? attempt.value : await app.query<{ snapshot_id: string }>(
    `SELECT * FROM orvok_radar_predict($1,$2,$3,$4,$5,'[0.6,0.4]'::jsonb,NULL)`,
    [predictorHash,target,q.questionId,selfAnswerId,ids.radarGrant],
  ).catch((error: unknown) => {
    throw new Error(`RETRY_PREDICTION_FAILED:${(error as { code?: string }).code ?? "UNKNOWN"}`);
  });
  const snapshotId = predicted.rows[0]!.snapshot_id;
  const snapshot = await owner.query<{ answerVersionId: string; predictedAt: Date; answeredAt: Date }>(
    `SELECT s."answerVersionId",s."predictedAt",a."answeredAt"
     FROM "SocialPredictionSnapshot" s JOIN "AnswerVersion" a ON a.id=$2
     WHERE s.id=$1`, [snapshotId,latestTargetAnswer]);
  const row = snapshot.rows[0];
  if (!row || (row.answeredAt < row.predictedAt && row.answerVersionId !== latestTargetAnswer))
    throw new Error("SNAPSHOT_DID_NOT_FREEZE_LATEST_SERIAL_TARGET_ANSWER");
  try {
    await app.query(`SELECT * FROM orvok_radar_predict($1,$2,$3,$4,$5,'[0.6,0.4]'::jsonb,NULL)`,
      [predictorHash,target,q.questionId,selfAnswerId,ids.radarGrant]);
    throw new Error("DUPLICATE_ROOT_SNAPSHOT_ACCEPTED");
  } catch (error) {
    if ((error as { code?: string }).code !== "23505") throw error;
  }
  console.log("Radar concurrency: target answer lock and duplicate root rejection passed");
} finally {
  try { await lock.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
  lock.release();
  if (pendingPrediction) await pendingPrediction.catch(() => undefined);
  if (created) {
    await owner.query(`DELETE FROM "Notification" WHERE "recipientId" IN ($1,$2)`, [predictor,target]);
    await owner.query(`DELETE FROM "AuditLog" WHERE "actorId" IN ($1,$2)`, [predictor,target]);
    await owner.query(`DELETE FROM "SocialPredictionSnapshot" WHERE "predictorId"=$1 AND "targetId"=$2`, [predictor,target]);
    await owner.query(`DELETE FROM "AnswerVersion" WHERE "subjectId" IN ($1,$2)`, [predictor,target]);
    await owner.query(`DELETE FROM "ConsentGrant" WHERE "subjectId" IN ($1,$2)`, [predictor,target]);
    await owner.query(`DELETE FROM "ConsentNoticePresentation" WHERE "userId" IN ($1,$2)`, [predictor,target]);
    await owner.query(`DELETE FROM "RadarInvitationAcceptance" WHERE id=$1`, [ids.acceptance]);
    await owner.query(`DELETE FROM "RadarInvitation" WHERE id=$1`, [ids.invitation]);
    await owner.query(`DELETE FROM "AuthSession" WHERE "userId" IN ($1,$2)`, [predictor,target]);
    await owner.query(`DELETE FROM "AuthIdentity" WHERE "userId" IN ($1,$2)`, [predictor,target]);
    await owner.query(`DELETE FROM "User" WHERE id IN ($1,$2)`, [predictor,target]);
  }
  await Promise.all([owner.end(),app.end()]);
}

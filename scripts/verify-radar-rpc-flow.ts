import "dotenv/config";
import { config as loadDotenv } from "dotenv";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";

loadDotenv({ path: ".env.local", quiet: true });
const ownerUrl = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
const appUrl = process.env.APP_DATABASE_URL;
if (!ownerUrl || !appUrl) throw new Error("RUNTIME_DATABASE_URLS_REQUIRED");
const owner = new Client({ connectionString: ownerUrl });
const app = new Client({ connectionString: appUrl });
const appSecond = new Client({ connectionString: appUrl });
const id = {
  admin: randomUUID(), predictor: randomUUID(), target: randomUUID(),
  predictorSession: randomUUID(), targetSession: randomUUID(),
  selfNotice: randomUUID(), radarNotice: randomUUID(),
  question: randomUUID(), version: randomUUID(), optionA: randomUUID(), optionB: randomUUID(),
  invitation: "", acceptance: "", predictorPresentation: "", targetPresentation: "",
  radarPresentation: "", predictorSelfGrant: "", targetSelfGrant: "", targetGrant: "",
  radarPresentation2: "", targetGrant2: "", targetAnswer2: "", snapshot2: "", revocation2: "",
  predictorAnswer: "", targetAnswer: "", snapshot: "", revocation: "",
};
const predictorHash = randomBytes(32).toString("hex");
const targetHash = randomBytes(32).toString("hex");
const noticeContent = "Aviso de consentimento fixture — somente teste automatizado";
const noticeHash = createHash("sha256").update(noticeContent).digest("hex");
const noticeVersion = `TEST-${randomBytes(4).toString("hex")}`;

async function expectCode(client: Client, sql: string, args: unknown[], code: string) {
  try {
    await client.query(sql, args);
    throw new Error("expected SQL rejection");
  } catch (error) {
    if ((error as { code?: string }).code !== code) throw error;
  }
}

await Promise.all([owner.connect(), app.connect(), appSecond.connect()]);
try {
  await owner.query(`INSERT INTO "User" (id,role,"updatedAt") VALUES
    ($1,'ADMIN',clock_timestamp()),($2,'USER',clock_timestamp()),($3,'USER',clock_timestamp())`, [id.admin,id.predictor,id.target]);
  await owner.query(`INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt") VALUES
    ($1,$3,'fixture-only',clock_timestamp()),($2,$4,'fixture-only',clock_timestamp())`,
    [id.predictor,id.target,`${id.predictor}@orvok.test`,`${id.target}@orvok.test`]);
  await owner.query(`INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt") VALUES
    ($1,$2,$3,$4,clock_timestamp()+interval '1 hour'),
    ($5,$6,$7,$8,clock_timestamp()+interval '1 hour')`,
    [id.predictorSession,id.predictor,predictorHash,randomUUID(),id.targetSession,id.target,targetHash,randomUUID()]);
  await owner.query(`INSERT INTO "ConsentNotice" (id,purpose,version,content,"contentHash",status,"approvedAt","approvedById") VALUES
    ($1,'SELF_ANSWER',$3,$4,$5,'APPROVED',clock_timestamp(),$6),
    ($2,'BE_PREDICTED',$3,$4,$5,'APPROVED',clock_timestamp(),$6)`,
    [id.selfNotice,id.radarNotice,noticeVersion,noticeContent,noticeHash,id.admin]);
  await owner.query(`INSERT INTO "Question" (id,"stableKey",domain) VALUES ($1,$2,'RADAR')`, [id.question,`TEST_${id.question}`]);
  await owner.query(`INSERT INTO "QuestionVersion" (id,"questionId",version,text,"familyKey","contentHash") VALUES
    ($1,$2,1,'fixture only','TEST',$3)`, [id.version,id.question,"a".repeat(64)]);
  await owner.query(`INSERT INTO "AnswerOption" (id,"questionVersionId",code,label,position) VALUES
    ($1,$3,'A','fixture A',0),($2,$3,'B','fixture B',1)`, [id.optionA,id.optionB,id.version]);

  id.invitation = (await app.query<{ value: string }>(`SELECT orvok_radar_invite($1,$2) AS value`, [predictorHash,id.target])).rows[0]!.value;
  id.acceptance = (await app.query<{ value: string }>(`SELECT orvok_radar_accept($1,$2) AS value`, [targetHash,id.invitation])).rows[0]!.value;
  id.predictorPresentation = (await app.query<{ presentation_id: string }>(
    `SELECT * FROM orvok_radar_present_notice($1,'SELF_ANSWER'::"ConsentPurpose")`, [predictorHash])).rows[0]!.presentation_id;
  id.targetPresentation = (await app.query<{ presentation_id: string }>(
    `SELECT * FROM orvok_radar_present_notice($1,'SELF_ANSWER'::"ConsentPurpose")`, [targetHash])).rows[0]!.presentation_id;
  id.predictorSelfGrant = (await app.query<{ grant_id: string }>(
    `SELECT * FROM orvok_radar_grant_self($1,$2,$3,$4)`, [predictorHash,id.predictorPresentation,noticeVersion,noticeHash])).rows[0]!.grant_id;
  id.targetSelfGrant = (await app.query<{ grant_id: string }>(
    `SELECT * FROM orvok_radar_grant_self($1,$2,$3,$4)`, [targetHash,id.targetPresentation,noticeVersion,noticeHash])).rows[0]!.grant_id;
  id.predictorAnswer = (await app.query<{ answer_id: string }>(
    `SELECT * FROM orvok_radar_answer($1,$2,$3,$4,NULL)`, [predictorHash,id.version,id.optionA,id.predictorSelfGrant])).rows[0]!.answer_id;
  id.radarPresentation = (await app.query<{ presentation_id: string }>(
    `SELECT * FROM orvok_radar_present_notice($1,'BE_PREDICTED'::"ConsentPurpose")`, [targetHash])).rows[0]!.presentation_id;
  await expectCode(app, `SELECT * FROM orvok_radar_grant($1,$2,$3,'PRIVATE'::"VisibilityScope",$4,$5)`,
    [targetHash,id.acceptance,id.radarPresentation,noticeVersion,"b".repeat(64)], "23514");
  id.targetGrant = (await app.query<{ grant_id: string; consent_version: number }>(
    `SELECT * FROM orvok_radar_grant($1,$2,$3,'PRIVATE'::"VisibilityScope",$4,$5)`,
    [targetHash,id.acceptance,id.radarPresentation,noticeVersion,noticeHash])).rows[0]!.grant_id;
  id.targetAnswer = (await app.query<{ answer_id: string }>(
    `SELECT * FROM orvok_radar_answer($1,$2,$3,$4,NULL)`, [targetHash,id.version,id.optionB,id.targetSelfGrant])).rows[0]!.answer_id;
  const predicted = (await app.query<{ snapshot_id: string; consent_version: number }>(
    `SELECT * FROM orvok_radar_predict($1,$2,$3,$4,$5,$6::jsonb,NULL)`,
    [predictorHash,id.target,id.version,id.predictorAnswer,id.targetGrant,"[0.6,0.4]"])).rows[0]!;
  id.snapshot = predicted.snapshot_id;
  if (predicted.consent_version !== 1) throw new Error("snapshot consent version incorrect");
  const stored = await owner.query<{ targetConsentVersion: number; targetConsentGrantId: string }>(
    `SELECT "targetConsentVersion","targetConsentGrantId" FROM "SocialPredictionSnapshot" WHERE id=$1`, [id.snapshot]);
  if (stored.rows[0]?.targetConsentVersion !== 1 || stored.rows[0]?.targetConsentGrantId !== id.targetGrant)
    throw new Error("snapshot did not preserve grant version");
  id.revocation = (await app.query<{ value: string }>(`SELECT orvok_radar_revoke($1,$2) AS value`,
    [targetHash,id.targetGrant])).rows[0]!.value;
  await expectCode(app, `SELECT * FROM orvok_radar_predict($1,$2,$3,$4,$5,$6::jsonb,NULL)`,
    [predictorHash,id.target,id.version,id.predictorAnswer,id.targetGrant,"[0.6,0.4]"], "23514");
  id.radarPresentation2 = (await app.query<{ presentation_id: string }>(
    `SELECT * FROM orvok_radar_present_notice($1,'BE_PREDICTED'::"ConsentPurpose")`, [targetHash])).rows[0]!.presentation_id;
  id.targetGrant2 = (await app.query<{ grant_id: string; consent_version: number }>(
    `SELECT * FROM orvok_radar_grant($1,$2,$3,'PRIVATE'::"VisibilityScope",$4,$5)`,
    [targetHash,id.acceptance,id.radarPresentation2,noticeVersion,noticeHash])).rows[0]!.grant_id;
  id.targetAnswer2 = (await app.query<{ answer_id: string }>(
    `SELECT * FROM orvok_radar_answer($1,$2,$3,$4,$5)`,
    [targetHash,id.version,id.optionB,id.targetSelfGrant,id.targetAnswer])).rows[0]!.answer_id;
  const [racePrediction,raceRevocation] = await Promise.allSettled([
    app.query<{ snapshot_id: string }>(`SELECT * FROM orvok_radar_predict($1,$2,$3,$4,$5,$6::jsonb,NULL)`,
      [predictorHash,id.target,id.version,id.predictorAnswer,id.targetGrant2,"[0.55,0.45]"]),
    appSecond.query<{ value: string }>(`SELECT orvok_radar_revoke($1,$2) AS value`, [targetHash,id.targetGrant2]),
  ]);
  if (raceRevocation.status !== "fulfilled") throw raceRevocation.reason;
  id.revocation2 = raceRevocation.value.rows[0]!.value;
  if (racePrediction.status === "fulfilled") {
    id.snapshot2 = racePrediction.value.rows[0]!.snapshot_id;
    const times = await owner.query<{ predictedAt: Date; revokedAt: Date }>(
      `SELECT s."predictedAt",r."revokedAt" FROM "SocialPredictionSnapshot" s
       JOIN "ConsentRevocation" r ON r."grantId"=s."targetConsentGrantId" WHERE s.id=$1`, [id.snapshot2]);
    if (!(times.rows[0]!.predictedAt < times.rows[0]!.revokedAt))
      throw new Error("prediction committed after concurrent revocation");
  } else if ((racePrediction.reason as { code?: string }).code !== "23514") {
    throw racePrediction.reason;
  }
  console.log("radar RPC flow: passed (invite, acceptance, notice, self answers, grant, snapshot, revocation, concurrent race)");
} finally {
  await owner.query(`DELETE FROM "AuditLog" WHERE "actorId" IN ($1,$2,$3)`, [id.admin,id.predictor,id.target]);
  if (id.snapshot) await owner.query(`DELETE FROM "SocialPredictionSnapshot" WHERE id=$1`, [id.snapshot]);
  if (id.snapshot2) await owner.query(`DELETE FROM "SocialPredictionSnapshot" WHERE id=$1`, [id.snapshot2]);
  if (id.revocation) await owner.query(`DELETE FROM "ConsentRevocation" WHERE id=$1`, [id.revocation]);
  if (id.revocation2) await owner.query(`DELETE FROM "ConsentRevocation" WHERE id=$1`, [id.revocation2]);
  await owner.query(`DELETE FROM "AnswerVersion" WHERE id IN ($1,$2,$3)`,
    [id.predictorAnswer || null,id.targetAnswer || null,id.targetAnswer2 || null]);
  await owner.query(`DELETE FROM "ConsentGrant" WHERE id IN ($1,$2,$3,$4)`,
    [id.predictorSelfGrant || null,id.targetSelfGrant || null,id.targetGrant || null,id.targetGrant2 || null]);
  await owner.query(`DELETE FROM "ConsentNoticePresentation" WHERE id IN ($1,$2,$3,$4)`,
    [id.predictorPresentation || null,id.targetPresentation || null,id.radarPresentation || null,id.radarPresentation2 || null]);
  await owner.query(`DELETE FROM "ConsentNotice" WHERE id IN ($1,$2)`, [id.selfNotice,id.radarNotice]);
  if (id.acceptance) await owner.query(`DELETE FROM "RadarInvitationAcceptance" WHERE id=$1`, [id.acceptance]);
  if (id.invitation) await owner.query(`DELETE FROM "RadarInvitation" WHERE id=$1`, [id.invitation]);
  await owner.query(`DELETE FROM "AuthSession" WHERE id IN ($1,$2)`, [id.predictorSession,id.targetSession]);
  await owner.query(`DELETE FROM "AuthIdentity" WHERE "userId" IN ($1,$2)`, [id.predictor,id.target]);
  await owner.query(`DELETE FROM "AnswerOption" WHERE id IN ($1,$2)`, [id.optionA,id.optionB]);
  await owner.query(`DELETE FROM "QuestionVersion" WHERE id=$1`, [id.version]);
  await owner.query(`DELETE FROM "Question" WHERE id=$1`, [id.question]);
  await owner.query(`DELETE FROM "User" WHERE id IN ($1,$2,$3)`, [id.admin,id.predictor,id.target]);
  const remaining = await owner.query<{ users: number; notices: number; questions: number }>(
    `SELECT (SELECT COUNT(*)::integer FROM "User" WHERE id IN ($1,$2,$3)) AS users,
      (SELECT COUNT(*)::integer FROM "ConsentNotice" WHERE id IN ($4,$5)) AS notices,
      (SELECT COUNT(*)::integer FROM "Question" WHERE id=$6) AS questions`,
    [id.admin,id.predictor,id.target,id.selfNotice,id.radarNotice,id.question]);
  const cleanupIncomplete = Boolean(remaining.rows[0]?.users || remaining.rows[0]?.notices || remaining.rows[0]?.questions);
  await Promise.all([owner.end(),app.end(),appSecond.end()]);
  if (cleanupIncomplete) throw new Error("RPC fixture cleanup incomplete");
}

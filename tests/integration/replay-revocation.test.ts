import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { RadarConsentService } from "../../src/lib/radar-consent";
import { cookieName } from "../../src/lib/auth/session";
import { randomToken, tokenHash } from "../../src/lib/auth/crypto";
import { GET, POST } from "../../src/app/api/v1/[[...path]]/route";

const url = process.env.DATABASE_URL;
describe.skipIf(!url)("replay após revogação e acesso ao snapshot", () => {
  const pool = new Pool({ connectionString: url });
  const radar = new RadarConsentService(pool);
  const ids = {
    predictor: randomUUID(), target: randomUUID(), admin: randomUUID(),
    predictorSession: randomUUID(), targetSession: randomUUID(),
    radarNotice: randomUUID(), selfNotice: randomUUID(),
    predictorSelfPresentation: randomUUID(), targetSelfPresentation: randomUUID(), targetRadarPresentation: randomUUID(),
    predictorSelfGrant: randomUUID(), targetSelfGrant: randomUUID(),
    question: randomUUID(), version: randomUUID(), optionA: randomUUID(), optionB: randomUUID(),
    predictorAnswer: randomUUID(), targetAnswer: randomUUID(),
  };
  const predictorToken = randomToken();
  const targetToken = randomToken();
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  const content = "FIXTURE ONLY - no official Radar notice";
  const contentHash = createHash("sha256").update(content).digest("hex");
  let invitationId: string;
  let acceptanceId: string;
  let grantId: string;
  let snapshotId: string;

  function apiRequest(path: string, method: "GET" | "POST", body?: unknown, key?: string) {
    return new Request(`${origin}/api/v1/${path}`, {
      method,
      headers: {
        cookie: `${cookieName()}=${predictorToken}`,
        ...(method === "POST" ? { origin, "content-type": "application/json", "Idempotency-Key": key ?? `fixture-${randomUUID()}` } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    });
  }
  const context = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "fixture-auth-secret-minimum-thirty-two-characters";
    await pool.query(`INSERT INTO "User" (id,role,"updatedAt") VALUES ($1,'USER',clock_timestamp()),($2,'USER',clock_timestamp()),($3,'ADMIN',clock_timestamp())`, [ids.predictor, ids.target, ids.admin]);
    await pool.query(`INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt") VALUES ($1,$3,'FIXTURE',clock_timestamp()),($2,$4,'FIXTURE',clock_timestamp())`, [ids.predictor, ids.target, `p-${ids.predictor}@example.invalid`, `t-${ids.target}@example.invalid`]);
    await pool.query(`INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt") VALUES ($1,$3,$5,$7,clock_timestamp()+interval '1 hour'),($2,$4,$6,$8,clock_timestamp()+interval '1 hour')`, [ids.predictorSession, ids.targetSession, ids.predictor, ids.target, tokenHash(predictorToken), tokenHash(targetToken), randomUUID(), randomUUID()]);
    await pool.query(`INSERT INTO "ConsentNotice" (id,purpose,version,content,"contentHash",status,"approvedAt","approvedById","testOnly") VALUES ($1,'BE_PREDICTED',$3,$5,$6,'APPROVED',clock_timestamp(),$7,true),($2,'SELF_ANSWER',$4,$5,$6,'APPROVED',clock_timestamp(),$7,true)`, [ids.radarNotice, ids.selfNotice, `FIXTURE-${ids.radarNotice}`, `FIXTURE-${ids.selfNotice}`, content, contentHash, ids.admin]);
    invitationId = await radar.invite({ predictorId: ids.predictor, targetId: ids.target });
    acceptanceId = await radar.accept({ invitationId, targetId: ids.target });
    await pool.query(`INSERT INTO "ConsentNoticePresentation" (id,"userId","noticeId","sessionId","invitationAcceptanceId","presentedAt") VALUES ($1,$4,$6,$8,NULL,clock_timestamp()),($2,$5,$6,$9,NULL,clock_timestamp()),($3,$5,$7,$9,$10,clock_timestamp())`, [ids.predictorSelfPresentation, ids.targetSelfPresentation, ids.targetRadarPresentation, ids.predictor, ids.target, ids.selfNotice, ids.radarNotice, ids.predictorSession, ids.targetSession, acceptanceId]);
    await pool.query(`INSERT INTO "ConsentGrant" (id,"subjectId",purpose,scope,"noticeVersion","noticeHash","consentVersion","noticePresentationId","grantedAt") VALUES ($1,$3,'SELF_ANSWER','PRIVATE',$5,$7,1,$8,clock_timestamp()),($2,$4,'SELF_ANSWER','PRIVATE',$6,$7,1,$9,clock_timestamp())`, [ids.predictorSelfGrant, ids.targetSelfGrant, ids.predictor, ids.target, `FIXTURE-${ids.selfNotice}`, `FIXTURE-${ids.selfNotice}`, contentHash, ids.predictorSelfPresentation, ids.targetSelfPresentation]);
    const grant = await radar.grant({ acceptanceId, targetId: ids.target, presentationId: ids.targetRadarPresentation, sessionId: ids.targetSession, notice: { version: `FIXTURE-${ids.radarNotice}`, hash: contentHash }, scope: "SHARED" });
    grantId = grant.id;
    await pool.query(`INSERT INTO "Question" (id,"stableKey",domain) VALUES ($1,$2,'RADAR')`, [ids.question, `FIXTURE_ONLY_${ids.question}`]);
    await pool.query(`INSERT INTO "QuestionVersion" (id,"questionId",version,text,"familyKey","contentHash") VALUES ($1,$2,1,'FIXTURE ONLY','fixture',$3)`, [ids.version, ids.question, "a".repeat(64)]);
    await pool.query(`INSERT INTO "AnswerOption" (id,"questionVersionId",code,label,position) VALUES ($1,$3,'A','FIXTURE',0),($2,$3,'B','FIXTURE',1)`, [ids.optionA, ids.optionB, ids.version]);
    await pool.query(`INSERT INTO "AnswerVersion" (id,"subjectId","questionVersionId","optionId","consentGrantId",version,"answeredAt","snapshotHash") VALUES ($1,$3,$5,$6,$7,1,clock_timestamp(),$9),($2,$4,$5,$6,$8,1,clock_timestamp(),$9)`, [ids.predictorAnswer, ids.targetAnswer, ids.predictor, ids.target, ids.version, ids.optionA, ids.predictorSelfGrant, ids.targetSelfGrant, "b".repeat(64)]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM "Notification" WHERE "recipientId"=ANY($1::uuid[])`, [[ids.predictor, ids.target]]);
    await pool.query(`DELETE FROM "AuditLog" WHERE "actorId"=ANY($1::uuid[])`, [[ids.predictor, ids.target, ids.admin]]);
    await pool.query(`DELETE FROM "ApiIdempotency" WHERE "actorId"=ANY($1::uuid[])`, [[ids.predictor, ids.target]]);
    if (snapshotId) await pool.query(`DELETE FROM "SocialPredictionSnapshot" WHERE id=$1`, [snapshotId]);
    await pool.query(`DELETE FROM "AnswerVersion" WHERE id=ANY($1::uuid[])`, [[ids.predictorAnswer, ids.targetAnswer]]);
    if (grantId) await pool.query(`DELETE FROM "ConsentRevocation" WHERE "grantId"=$1`, [grantId]);
    await pool.query(`DELETE FROM "ConsentGrant" WHERE id=ANY($1::uuid[])`, [[ids.predictorSelfGrant, ids.targetSelfGrant, grantId].filter(Boolean)]);
    await pool.query(`DELETE FROM "ConsentNoticePresentation" WHERE id=ANY($1::uuid[])`, [[ids.predictorSelfPresentation, ids.targetSelfPresentation, ids.targetRadarPresentation]]);
    if (invitationId) {
      await pool.query(`DELETE FROM "RadarInvitationAcceptance" WHERE "invitationId"=$1`, [invitationId]);
      await pool.query(`DELETE FROM "RadarInvitation" WHERE id=$1`, [invitationId]);
    }
    await pool.query(`DELETE FROM "AnswerOption" WHERE id=ANY($1::uuid[])`, [[ids.optionA, ids.optionB]]);
    await pool.query(`DELETE FROM "QuestionVersion" WHERE id=$1`, [ids.version]);
    await pool.query(`DELETE FROM "Question" WHERE id=$1`, [ids.question]);
    await pool.query(`DELETE FROM "ConsentNotice" WHERE id=ANY($1::uuid[])`, [[ids.radarNotice, ids.selfNotice]]);
    await pool.query(`DELETE FROM "AuthSession" WHERE id=ANY($1::uuid[])`, [[ids.predictorSession, ids.targetSession]]);
    await pool.query(`DELETE FROM "AuthIdentity" WHERE "userId"=ANY($1::uuid[])`, [[ids.predictor, ids.target]]);
    await pool.query(`DELETE FROM "User" WHERE id=ANY($1::uuid[])`, [[ids.predictor, ids.target, ids.admin]]);
    await pool.end();
  });

  it("não reapresenta 201 cacheado após suspensão ou revogação", async () => {
    const body = { targetId: ids.target, questionVersionId: ids.version, selfAnswerVersionId: ids.predictorAnswer, grantId, probabilityVector: [0.7, 0.3] };
    const key = `fixture-${randomUUID()}`;
    const first = await POST(apiRequest("radar/predictions", "POST", body, key), context("radar/predictions"));
    expect(first.status).toBe(201);
    snapshotId = (await first.json()).snapshotId;
    const visible = await GET(apiRequest(`radar/snapshots/${snapshotId}`, "GET"), context(`radar/snapshots/${snapshotId}`));
    expect(visible.status).toBe(200);
    await pool.query(`UPDATE "User" SET status='SUSPENDED',"updatedAt"=clock_timestamp() WHERE id=$1`, [ids.target]);
    const suspended = await GET(apiRequest(`radar/snapshots/${snapshotId}`, "GET"), context(`radar/snapshots/${snapshotId}`));
    expect(suspended.status).toBe(404);
    await pool.query(`UPDATE "User" SET status='ACTIVE',"updatedAt"=clock_timestamp() WHERE id=$1`, [ids.target]);
    await radar.revoke({ grantId, targetId: ids.target });
    const replay = await POST(apiRequest("radar/predictions", "POST", body, key), context("radar/predictions"));
    expect(replay.status).not.toBe(201);
    const count = await pool.query(`SELECT count(*)::integer AS n FROM "SocialPredictionSnapshot" WHERE "predictorId"=$1 AND "targetId"=$2`, [ids.predictor, ids.target]);
    expect(count.rows[0]?.n).toBe(1);
    const revoked = await GET(apiRequest(`radar/snapshots/${snapshotId}`, "GET"), context(`radar/snapshots/${snapshotId}`));
    expect(revoked.status).toBe(404);
    const exported = await GET(apiRequest("me/export", "GET"), context("me/export"));
    const exportJson = await exported.json();
    expect(exportJson.export.predictionsMade).toEqual([]);
    expect(exportJson.export.restrictedPredictionsMetadata).toEqual(expect.arrayContaining([expect.objectContaining({ id: snapshotId })]));
  });
});

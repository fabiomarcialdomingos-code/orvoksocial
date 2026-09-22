import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { tokenHash } from "../../src/lib/auth/crypto";

test("duas contas de teste percorrem convite, aceite, aviso, consentimento, respostas e snapshot", async ({ browser }) => {
  test.skip(!process.env.DATABASE_URL, "PostgreSQL de teste necessário para jornada real");
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const predictor = randomUUID();
  const target = randomUUID();
  const predictorSession = randomUUID();
  const targetSession = randomUUID();
  const predictorToken = randomBytes(32).toString("base64url");
  const targetToken = randomBytes(32).toString("base64url");
  const predictorContext = await browser.newContext();
  const targetContext = await browser.newContext();
  const predictorPage = await predictorContext.newPage();
  const targetPage = await targetContext.newPage();
  let created = false;
  try {
    const fixture = await owner.query<{ questionId: string; optionA: string; optionB: string }>(
      `SELECT qv.id AS "questionId", MIN(ao.id::text) AS "optionA", MAX(ao.id::text) AS "optionB"
       FROM "QuestionVersion" qv JOIN "AnswerOption" ao ON ao."questionVersionId"=qv.id
       WHERE qv."catalogStatus"='TEST_ONLY' AND qv."instrumentVersion" LIKE '%TEST_ONLY%'
       GROUP BY qv.id HAVING COUNT(*)=2 ORDER BY qv.id LIMIT 1`,
    );
    expect(fixture.rows.length, "catálogo TEST_ONLY importado").toBeGreaterThan(0);
    const question = fixture.rows[0]!;
    await owner.query(`INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp()),($2,clock_timestamp())`, [predictor, target]);
    created = true;
    await owner.query(`INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt") VALUES
      ($1,$3,'TEST_ONLY',clock_timestamp()),($2,$4,'TEST_ONLY',clock_timestamp())`, [predictor, target, `${predictor}@example.test`, `${target}@example.test`]);
    await owner.query(`INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt") VALUES
      ($1,$2,$3,$4,clock_timestamp()+interval '1 hour'),($5,$6,$7,$8,clock_timestamp()+interval '1 hour')`,
    [predictorSession, predictor, tokenHash(predictorToken), randomUUID(), targetSession, target, tokenHash(targetToken), randomUUID()]);
    await predictorContext.addCookies([{ name: "orvok_session", value: predictorToken, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
    await targetContext.addCookies([{ name: "orvok_session", value: targetToken, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);

    await predictorPage.goto("/convites");
    await predictorPage.getByLabel("Identificador da pessoa convidada").fill(target);
    await predictorPage.getByRole("button", { name: "Enviar convite" }).click();
    await expect(predictorPage.getByText(/Convite registrado/)).toBeVisible();
    const invitation = await owner.query<{ id: string }>(`SELECT id FROM "RadarInvitation" WHERE "predictorId"=$1 AND "targetId"=$2`, [predictor, target]);
    expect(invitation.rowCount).toBe(1);

    await targetPage.goto(`/aceitar-convite?convite=${invitation.rows[0]!.id}`);
    await targetPage.getByRole("button", { name: "Aceitar convite" }).click();
    await expect(targetPage.getByText(/Convite aceito/)).toBeVisible();
    const acceptance = await owner.query<{ id: string }>(`SELECT id FROM "RadarInvitationAcceptance" WHERE "invitationId"=$1`, [invitation.rows[0]!.id]);
    expect(acceptance.rowCount).toBe(1);

    await targetPage.goto(`/consentimento?aceite=${acceptance.rows[0]!.id}`);
    await expect(targetPage.locator(".notice")).toContainText("TEST_ONLY");
    await targetPage.getByRole("checkbox", { name: /Li o aviso acima/ }).check();
    await targetPage.getByRole("button", { name: "Registrar consentimento" }).click();
    await expect(targetPage.getByText(/Consentimento registrado/)).toBeVisible();

    for (const page of [targetPage, predictorPage]) {
      await page.goto("/radar");
      await expect(page.getByText(/TEST_ONLY · Este catálogo/)).toBeVisible();
      await expect(page.getByText(/Aviso de respostas próprias/)).toBeVisible();
      await page.getByRole("checkbox", { name: /Li o aviso acima e consinto/ }).check();
      await page.getByRole("button", { name: "Confirmar consentimento" }).click();
      const ownSection = page.locator("#responder");
      await expect(ownSection.getByLabel("Pergunta de teste")).toBeVisible();
      await ownSection.getByLabel("Pergunta de teste").selectOption(question.questionId);
      await ownSection.getByLabel("Sua resposta").selectOption(question.optionA);
      await ownSection.getByRole("button", { name: "Registrar versão da resposta" }).click();
      await expect(page.getByText(/Resposta própria registrada/)).toBeVisible();
    }

    const notifications = targetPage.locator("#notificacoes");
    await expect(notifications.getByText(/RADAR_INVITATION_RECEIVED/)).toBeVisible();
    await notifications.getByRole("button", { name: "Marcar como lida" }).first().click();
    await expect(notifications.getByText(/RADAR_INVITATION_RECEIVED · READ/)).toBeVisible();
    await notifications.getByRole("button", { name: "Dispensar" }).first().click();
    await expect(notifications.getByText(/RADAR_INVITATION_RECEIVED · DISMISSED/)).toBeVisible();
    const readState = await owner.query<{ state: string }>(`SELECT state FROM "Notification" WHERE "recipientId"=$1 AND "eventType"='RADAR_INVITATION_RECEIVED'`, [target]);
    expect(readState.rows[0]?.state).toBe("DISMISSED");

    await predictorPage.goto("/radar");
    await expect(predictorPage.getByLabel("Relação elegível")).toBeVisible();
    const opportunity = predictorPage.getByLabel("Relação elegível");
    await expect(opportunity.locator("option")).toHaveCount(2);
    await opportunity.selectOption({ index: 1 });
    await predictorPage.locator("#prever").getByLabel("Pergunta de teste", { exact: true }).selectOption(question.questionId);
    const probabilityInputs = predictorPage.locator(".radar-probabilities input");
    await probabilityInputs.nth(0).fill("60");
    await probabilityInputs.nth(1).fill("40");
    let postCount = 0;
    predictorPage.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/api/v1/radar/predictions")) postCount++; });
    await predictorPage.getByRole("button", { name: "Revisar previsão" }).click();
    await expect(predictorPage.getByText(/Após a confirmação, o snapshot não pode ser alterado/)).toBeVisible();
    await predictorPage.getByRole("button", { name: "Voltar", exact: true }).click();
    expect(postCount).toBe(0);
    await predictorPage.getByRole("button", { name: "Revisar previsão" }).click();
    await predictorPage.getByRole("button", { name: "Confirmar previsão" }).click();
    await expect(predictorPage.getByText(/Previsão enviada e snapshot gravado/)).toBeVisible();
    expect(postCount).toBe(1);
    const snapshot = await owner.query<{ id: string; targetConsentVersion: number }>(
      `SELECT id,"targetConsentVersion" FROM "SocialPredictionSnapshot" WHERE "predictorId"=$1 AND "targetId"=$2`, [predictor, target]);
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.rows[0]!.targetConsentVersion).toBe(1);
    await expect(owner.query(`UPDATE "SocialPredictionSnapshot" SET "probabilityVector"='[0.5,0.5]'::jsonb WHERE id=$1`, [snapshot.rows[0]!.id])).rejects.toMatchObject({ code: "P0001" });

    await targetPage.goto("/convites");
    await targetPage.getByLabel("Identificador da pessoa convidada").fill(predictor);
    await targetPage.getByRole("button", { name: "Enviar convite" }).click();
    await expect(targetPage.getByText(/Convite registrado/)).toBeVisible();
    const reverse = await owner.query<{ id: string }>(`SELECT id FROM "RadarInvitation" WHERE "predictorId"=$1 AND "targetId"=$2`, [target, predictor]);
    await predictorPage.goto(`/aceitar-convite?convite=${reverse.rows[0]!.id}`);
    await predictorPage.getByRole("button", { name: "Aceitar convite" }).click();
    await expect(predictorPage.getByText(/Convite aceito/)).toBeVisible();
    const reverseAcceptance = await owner.query<{ id: string }>(`SELECT id FROM "RadarInvitationAcceptance" WHERE "invitationId"=$1`, [reverse.rows[0]!.id]);
    await predictorPage.goto(`/consentimento?aceite=${reverseAcceptance.rows[0]!.id}`);
    await expect(predictorPage.locator(".notice")).toContainText("TEST_ONLY");
    await predictorPage.getByRole("checkbox", { name: /Li o aviso acima/ }).check();
    await predictorPage.getByRole("button", { name: "Registrar consentimento" }).click();
    await expect(predictorPage.getByText(/Consentimento registrado/)).toBeVisible();
    await targetPage.goto("/radar");
    await expect(targetPage.getByText(new RegExp(`dois sentidos com ${predictor}`))).toBeVisible();

    await targetPage.goto("/consentimento");
    const grant = await owner.query<{ id: string }>(`SELECT id FROM "ConsentGrant" WHERE "subjectId"=$1 AND purpose='BE_PREDICTED'`, [target]);
    await targetPage.getByRole("button", { name: new RegExp(`consentimento ${grant.rows[0]!.id}`) }).click();
    await targetPage.getByRole("button", { name: "Revogar consentimento" }).click();
    await expect(targetPage.getByText(/Consentimento revogado/)).toBeVisible();
    await predictorPage.goto("/radar");
    await expect(predictorPage.getByText(/Nenhuma relação elegível/)).toBeVisible();
    await expect(predictorPage.getByText(/Nenhuma relação recíproca/)).toBeVisible();

    await targetPage.goto("/meus-dados");
    await expect(targetPage.getByRole("heading", { name: "Acesso e solicitações" })).toBeVisible();
    const exported = await targetPage.request.get("/api/v1/me/export");
    expect(exported.status()).toBe(200);
    const exportedData = await exported.json();
    expect(exportedData.export.profile.id).toBe(target);
    await targetPage.getByRole("checkbox", { name: /solicitando análise e processamento/ }).check();
    await targetPage.getByRole("button", { name: "Solicitar exclusão" }).click();
    await expect(targetPage.getByText(/Solicitação .* recebida/)).toBeVisible();
    const erasure = await owner.query(`SELECT 1 FROM "DataRequest" WHERE "subjectId"=$1 AND type='ERASURE'`, [target]);
    expect(erasure.rowCount).toBe(1);
  } finally {
    await Promise.all([predictorContext.close(), targetContext.close()]);
    if (created) {
      const actors = [predictor, target];
      await owner.query(`DELETE FROM "Notification" WHERE "recipientId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "AuditLog" WHERE "actorId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "DataRequest" WHERE "subjectId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "ApiIdempotency" WHERE "actorId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "SocialPredictionSnapshot" WHERE "predictorId"=ANY($1::uuid[]) OR "targetId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "ConsentRevocation" WHERE "subjectId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "AnswerVersion" WHERE "subjectId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "ConsentGrant" WHERE "subjectId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "ConsentNoticePresentation" WHERE "userId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "RadarInvitationAcceptance" WHERE "targetId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "RadarInvitation" WHERE "predictorId"=ANY($1::uuid[]) OR "targetId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "AuthSession" WHERE "userId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "AuthIdentity" WHERE "userId"=ANY($1::uuid[])`, [actors]);
      await owner.query(`DELETE FROM "User" WHERE id=ANY($1::uuid[])`, [actors]);
    }
    await owner.end();
  }
});

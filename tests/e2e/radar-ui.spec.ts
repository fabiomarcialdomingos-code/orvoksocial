import { expect, test, type Page, type Route } from "@playwright/test";

const questionId = "00000000-0000-0000-0000-000000000101";
const optionA = "00000000-0000-0000-0000-000000000102";
const optionB = "00000000-0000-0000-0000-000000000103";

async function mockRadar(page: Page, withQuestion = true, withGrant = false) {
  let noticeRequests = 0;
  await page.route("**/api/v1/radar/questions", (route) => route.fulfill({ json: { schemaVersion: "1", items: withQuestion ? [{
    questionVersionId: questionId, version: 1, instrumentVersion: "TEST_ONLY_V1", catalogStatus: "TEST_ONLY",
    text: "Pergunta fictícia de teste?", options: [{ id: optionA, label: "Opção fictícia A", position: 0 }, { id: optionB, label: "Opção fictícia B", position: 1 }],
  }] : [] } }));
  await page.route("**/api/v1/radar/answers", (route) => route.fulfill({ json: { schemaVersion: "1", items: [], nextCursor: null } }));
  await page.route("**/api/v1/radar/dashboard", (route) => route.fulfill({ json: { schemaVersion: "1", made: [], received: [], pendingInvitations: [], matches: [] } }));
  await page.route("**/api/v1/radar/opportunities", (route) => route.fulfill({ json: { schemaVersion: "1", items: [], nextCursor: null } }));
  await page.route("**/api/v1/notifications", (route) => route.fulfill({ json: { schemaVersion: "1", items: [], nextCursor: null } }));
  await page.route("**/api/v1/radar/consents", (route) => route.fulfill({ json: { schemaVersion: "1", items: withGrant ? [{ id: "00000000-0000-0000-0000-000000000104", purpose: "SELF_ANSWER", revokedAt: null }] : [], nextCursor: null } }));
  await page.route("**/api/v1/consent-notice?purpose=SELF_ANSWER", (route) => {
    noticeRequests++;
    return route.fulfill({ json: { schemaVersion: "1", version: "TEST_ONLY_1", content: "Aviso fictício de teste para respostas próprias.", contentHash: "a".repeat(64), presentationId: "00000000-0000-0000-0000-000000000105" } });
  });
  return () => noticeRequests;
}

test("Radar vazio não apresenta aviso nem perguntas oficiais", async ({ page }) => {
  const noticeCount = await mockRadar(page, false);
  await page.goto("/radar");
  await expect(page.getByRole("heading", { name: "Perspectivas entre pessoas." })).toBeVisible();
  await expect(page.getByText(/catálogo de teste está vazio/i)).toBeVisible();
  await expect(page.getByText(/TEST_ONLY · Este catálogo/)).toBeVisible();
  expect(noticeCount()).toBe(0);
});

test("Radar apresenta aviso próprio antes de habilitar respostas", async ({ page }) => {
  const noticeCount = await mockRadar(page);
  await page.goto("/radar");
  await expect(page.getByText("Aviso fictício de teste para respostas próprias.")).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirmar consentimento" });
  await expect(confirm).toBeDisabled();
  await page.getByRole("checkbox", { name: /Li o aviso acima/ }).check();
  await expect(confirm).toBeEnabled();
  expect(noticeCount()).toBe(1);
});

test("Radar com grant existente não cria nova apresentação do aviso", async ({ page }) => {
  const noticeCount = await mockRadar(page, true, true);
  await page.goto("/radar");
  await expect(page.getByLabel("Pergunta de teste")).toBeVisible();
  expect(noticeCount()).toBe(0);
});

test("Radar recompõe painéis em seis larguras sem rolagem horizontal", async ({ page }) => {
  await mockRadar(page);
  for (const width of [1440, 1280, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/radar");
    await expect(page.getByRole("heading", { name: "Seu painel" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `Radar at ${width}px`).toBe(false);
  }
});

test("convite, aceite, consentimento, dados e snapshot não transbordam no mobile", async ({ page }) => {
  for (const width of [768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/convites", "/aceitar-convite", "/consentimento", "/meus-dados", "/radar/snapshots/00000000-0000-0000-0000-000000000001"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `${path} at ${width}px`).toBe(false);
    }
  }
});

test("confirmação com identificador de convite permanece legível em 320 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const id = "00000000-0000-0000-0000-000000000501";
  await page.route("**/api/v1/radar/invitations", (route) => route.request().method() === "POST"
    ? route.fulfill({ status: 201, json: { invitationId: id } })
    : route.fulfill({ json: { items: [] } }));
  await page.goto("/convites");
  await page.getByLabel("Identificador da pessoa convidada").fill(id);
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText(/Convite registrado/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("sem oportunidade a previsão é bloqueada e não envia POST", async ({ page }) => {
  await mockRadar(page, true, true);
  let posts = 0;
  await page.route("**/api/v1/radar/predictions", (route) => { posts++; return route.fulfill({ status: 500 }); });
  await page.goto("/radar");
  await expect(page.getByText(/Nenhuma relação elegível/)).toBeVisible();
  expect(posts).toBe(0);
});

test("aviso atrasado do primeiro aceite nunca substitui o aviso do aceite atual", async ({ page }) => {
  const first = "00000000-0000-0000-0000-000000000201";
  const second = "00000000-0000-0000-0000-000000000202";
  let delayed: Route | null = null;
  await page.route("**/api/v1/radar/consents", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/v1/consent-notice?purpose=BE_PREDICTED&acceptanceId=*", async (route) => {
    if (route.request().url().includes(first)) { delayed = route; return; }
    await route.fulfill({ json: { version: "TEST_ONLY_SECOND", content: "Aviso atual do segundo aceite", contentHash: "b".repeat(64), presentationId: "00000000-0000-0000-0000-000000000203" } });
  });
  await page.goto(`/consentimento?aceite=${first}`);
  await expect.poll(() => delayed !== null).toBe(true);
  await page.getByLabel("Identificador do aceite").fill(second);
  await expect(page.locator(".notice")).toContainText("Aviso atual do segundo aceite");
  const old = delayed as Route | null;
  if (old) await old.fulfill({ json: { version: "TEST_ONLY_FIRST", content: "Aviso antigo", contentHash: "a".repeat(64), presentationId: "00000000-0000-0000-0000-000000000204" } }).catch(() => {});
  await expect(page.locator(".notice")).toContainText("Aviso atual do segundo aceite");
  await expect(page.locator(".notice")).not.toContainText("Aviso antigo");
});

test("aceite lista apenas convites recebidos e ainda válidos", async ({ page }) => {
  const own = "00000000-0000-0000-0000-000000000301";
  const other = "00000000-0000-0000-0000-000000000302";
  await page.route("**/api/v1/users/me", (route) => route.fulfill({ json: { user: { id: own } } }));
  await page.route("**/api/v1/radar/invitations", (route) => route.fulfill({ json: { items: [
    { id: "00000000-0000-0000-0000-000000000311", predictorId: other, targetId: own, invitedAt: new Date().toISOString(), acceptedAt: null, acceptanceId: null, expiresAt: new Date(Date.now() + 3600_000).toISOString() },
    { id: "00000000-0000-0000-0000-000000000312", predictorId: other, targetId: own, invitedAt: new Date().toISOString(), acceptedAt: null, acceptanceId: null, expiresAt: new Date(Date.now() - 3600_000).toISOString() },
    { id: "00000000-0000-0000-0000-000000000313", predictorId: own, targetId: other, invitedAt: new Date().toISOString(), acceptedAt: null, acceptanceId: null, expiresAt: null },
  ] } }));
  await page.goto("/aceitar-convite");
  await expect(page.getByRole("button", { name: `Selecionar convite de ${other}` })).toHaveCount(1);
  await page.getByRole("button", { name: `Selecionar convite de ${other}` }).click();
  await expect(page.getByLabel("Identificador do convite recebido")).toHaveValue("00000000-0000-0000-0000-000000000311");
});

test("notificação de teste progride de não lida a lida e dispensada", async ({ page }) => {
  await mockRadar(page, false);
  const id = "00000000-0000-0000-0000-000000000401";
  await page.route("**/api/v1/notifications", (route) => route.fulfill({ json: { items: [{ id, eventType: "RADAR_INVITATION_RECEIVED", state: "UNREAD", createdAt: new Date().toISOString() }] } }));
  await page.route(`**/api/v1/notifications/${id}/read`, (route) => route.fulfill({ json: { id, state: "READ" } }));
  await page.route(`**/api/v1/notifications/${id}/dismiss`, (route) => route.fulfill({ json: { id, state: "DISMISSED" } }));
  await page.goto("/radar");
  const section = page.locator("#notificacoes");
  await section.getByRole("button", { name: "Marcar como lida" }).click();
  await expect(section.getByText(/RADAR_INVITATION_RECEIVED · READ/)).toBeVisible();
  await section.getByRole("button", { name: "Dispensar" }).click();
  await expect(section.getByText(/RADAR_INVITATION_RECEIVED · DISMISSED/)).toBeVisible();
  await expect(section.getByRole("button", { name: "Dispensar" })).toHaveCount(0);
});

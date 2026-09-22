import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "../../src/lib/auth/crypto";

test("landing follows the ORVOK visual structure", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("ORVOK Social");
  await expect(
    page.getByRole("heading", { name: "Pessoas conectam perspectivas." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ORVOK — início" }),
  ).toBeVisible();
  await expect(page.locator("#mundo")).toBeVisible();
  await expect(page.locator("#pessoas")).toBeVisible();
  await expect(page.locator("#voce")).toBeVisible();
});

test("mobile navigation and forms remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByText("Menu", { exact: true }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Navegação móvel" })
      .getByRole("link", { name: "Pessoas" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Criar conta/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Comece uma nova perspectiva." }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test("consent is blocked when the approved notice is unavailable", async ({
  page,
}) => {
  await page.route(
    "**/api/v1/consent-notice?purpose=BE_PREDICTED&acceptanceId=*",
    (route) =>
      route.fulfill({
        status: 503,
        body: JSON.stringify({ code: "NOTICE_UNAVAILABLE" }),
      }),
  );
  await page.goto("/consentimento?aceite=00000000-0000-0000-0000-000000000001");
  await expect(
    page.getByText(
      /aviso de consentimento aprovado ainda não está disponível/i,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar consentimento" }),
  ).toBeDisabled();
});

test("keyboard skip link reaches main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Ir para o conteúdo" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#conteudo$/);
});

test("email action links prefill token and remove it from the visible URL", async ({ page }) => {
  const token = "a".repeat(43);
  for (const path of ["/verificar-email", "/nova-senha"]) {
    const response = await page.goto(`${path}#token=${token}`);
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(page.getByLabel("Código recebido por e-mail")).toHaveValue(token);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("foundation layouts avoid horizontal overflow at official breakpoints", async ({ page }) => {
  for (const width of [1440, 1280, 1024, 768, 390, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/cadastro", "/consentimento"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `${path} at ${width}px`).toBe(false);
    }
  }
});

test("keyboard focus has a high-contrast indicator on form controls", async ({ page }) => {
  await page.goto("/cadastro");
  const email = page.getByLabel("E-mail");
  await email.focus();
  const outline = await email.evaluate((element) => getComputedStyle(element).outlineColor);
  expect(outline).toBe("rgb(14, 15, 18)");
});

test("keyboard opens and closes the mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const menu = page.locator(".mobile-menu summary");
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".mobile-menu")).toHaveAttribute("open", "");
  await expect(page.getByRole("navigation", { name: "Navegação móvel" }).getByRole("link", { name: "Comunidade" })).toBeVisible();
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".mobile-menu")).not.toHaveAttribute("open", "");
});

test("consent notice can receive keyboard focus before confirmation", async ({ page }) => {
  await page.route("**/api/v1/consent-notice?purpose=BE_PREDICTED&acceptanceId=*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      schemaVersion: "1", version: "fixture-only", content: "Aviso de teste, sem efeito de produto.",
      contentHash: "a".repeat(64), presentationId: "00000000-0000-0000-0000-000000000002",
    }) }),
  );
  await page.goto("/consentimento?aceite=00000000-0000-0000-0000-000000000001");
  const notice = page.locator(".notice");
  await expect(notice).toBeVisible();
  await notice.focus();
  await expect(notice).toBeFocused();
  await expect(page.getByRole("checkbox", { name: /Li o aviso acima/ })).toBeEnabled();
});

test("revocation choices identify each grant and expose selection", async ({ page }) => {
  await page.route("**/api/v1/radar/consents", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ schemaVersion: "1", items: [
      { id: "00000000-0000-0000-0000-000000000011", purpose: "BE_PREDICTED", scope: "PRIVATE", noticeVersion: "test-1", consentVersion: 1, grantedAt: new Date().toISOString(), revokedAt: null },
      { id: "00000000-0000-0000-0000-000000000012", purpose: "BE_PREDICTED", scope: "PRIVATE", noticeVersion: "test-2", consentVersion: 2, grantedAt: new Date().toISOString(), revokedAt: null },
    ] }),
  }));
  await page.goto("/consentimento");
  const first = page.getByRole("button", { name: /consentimento 00000000-0000-0000-0000-000000000011, versão 1/ });
  const second = page.getByRole("button", { name: /consentimento 00000000-0000-0000-0000-000000000012, versão 2/ });
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(first).toHaveAttribute("aria-pressed", "false");
});

test("verified test account signs in and signs out through the real API", async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, "PostgreSQL owner URL is needed only for fixture setup");
  const owner = new Pool({ connectionString: process.env.DATABASE_URL });
  const id = randomUUID();
  const email = `browser-${id}@example.test`;
  const password = "Senha E2E longa e exclusiva 12345!";
  try {
    await owner.query(`INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp())`, [id]);
    await owner.query(`INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt") VALUES ($1,$2,$3,clock_timestamp())`,
      [id, email, await hashPassword(password)]);
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/convites$/);
    const own = await page.request.get("/api/v1/users/me");
    expect(own.status()).toBe(200);
    expect((await own.json()).user.id).toBe(id);
    const logout = await page.evaluate(async () => fetch("/api/v1/auth/logout", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }).then((response) => response.status));
    expect(logout).toBe(204);
    expect((await page.request.get("/api/v1/users/me")).status()).toBe(401);
  } finally {
    await owner.query(`DELETE FROM "AuditLog" WHERE "actorId"=$1`, [id]);
    await owner.query(`DELETE FROM "AuthSession" WHERE "userId"=$1`, [id]);
    await owner.query(`DELETE FROM "AuthIdentity" WHERE "userId"=$1`, [id]);
    await owner.query(`DELETE FROM "User" WHERE id=$1`, [id]);
    await owner.end();
  }
});

// Optional browser QA: real Perspectives API + SQL fixture; auth/social/world HTTP fixtures.
// Run the normal test with ORVOK_BROWSER_HARNESS pointing to this file and a Next server running.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
export async function runBrowser({ api, owner, world, users, eid, yes, no }) {
  const { chromium } = await import(
    process.env.ORVOK_PLAYWRIGHT_MODULE || "playwright"
  );
  const options = { headless: true };
  if (process.env.ORVOK_CHROMIUM_MODULE) {
    const { default: binary } = await import(process.env.ORVOK_CHROMIUM_MODULE);
    options.executablePath = await binary.executablePath();
    options.args = binary.args;
  }
  const browser = await chromium.launch(options),
    origin = process.env.ORVOK_UI_ORIGIN || "http://127.0.0.1:3000";
  const output = process.env.ORVOK_UI_OUTPUT || ".local/perspectives-ui";
  await mkdir(output, { recursive: true });
  let serial = Promise.resolve();
  const errors = [];
  async function capture(p, name) {
    await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({ path: `${output}/${name}.png`, fullPage: false });
  }
  async function pageFor(u) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/v1/**", async (route) => {
      const run = async () => {
        try {
          const req = route.request(),
            url = new URL(req.url()),
            path = url.pathname.replace("/api/v1", ""),
            body = req.method() === "POST" ? req.postDataJSON() : undefined;
          let data;
          if (path.startsWith("/perspectives/"))
            data = await api(u, path, body);
          else if (path === "/auth/session")
            data = { authenticated: true, userId: u.id, role: "USER" };
          else if (path === "/social/profile")
            data = {
              profile: {
                userId: u.id,
                displayName: u.name,
                bio: "Perfil fictício de revisão visual.",
              },
            };
          else if (path === "/world/events")
            data = {
              items: [
                {
                  id: eid,
                  title: "A tecnologia vai mudar como acompanhamos o esporte?",
                  category: "tecnologia",
                  description: "Evento fictício para teste da interface.",
                  resolutionCriteria:
                    "Critério demonstrativo, sem resultado oficial.",
                  status: "PUBLISHED",
                  opensAt: new Date(Date.now() - 86400000).toISOString(),
                  closesAt: new Date(Date.now() + 172800000).toISOString(),
                  opportunities: [
                    { id: yes, label: "Sim", code: "yes", position: 0 },
                    { id: no, label: "Não", code: "no", position: 1 },
                  ],
                },
              ],
              nextCursor: null,
            };
          else if (path === "/world/predictions")
            data = {
              items: (
                await owner(
                  'SELECT DISTINCT ON ("eventId") "eventId","opportunityId",confidence FROM "WorldPrediction" WHERE "predictorId"=$1 ORDER BY "eventId","predictedAt" DESC',
                  [u.id],
                )
              ).rows,
            };
          else if (path === `/world/events/${eid}` && body) {
            await world(u, body.opportunityId, body.confidence);
            data = { ok: true };
          } else if (path.endsWith("/resolution")) data = { resolution: null };
          else if (path === "/people")
            data = {
              items: users.map((x) => ({ userId: x.id, displayName: x.name })),
            };
          else data = { items: [], nextCursor: null };
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(data),
          });
        } catch (e) {
          errors.push(String(e));
          await route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({ code: "RULE_VIOLATION" }),
          });
        }
      };
      serial = serial.then(run);
      await serial;
    });
    return page;
  }
  try {
    const publicPage = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await publicPage.goto(origin);
    await publicPage.getByRole("heading", { name: /Você é mais/ }).waitFor();
    await capture(publicPage, "home-desktop");
    await publicPage.setViewportSize({ width: 390, height: 844 });
    await capture(publicPage, "home-mobile");
    assert.equal(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "public mobile overflow",
    );
    const p = await pageFor(users[2]);
    await p.goto(origin + "/sobre-mim");
    await p
      .getByRole("heading", { name: "Você, em suas próprias palavras." })
      .waitFor();
    await p.getByRole("button", { name: "Crush", exact: true }).click();
    await p.getByRole("checkbox").check();
    await p.getByRole("button", { name: "Começar minha rodada" }).click();
    await p.locator(".question-main").waitFor();
    await capture(p, "question-desktop");
    for (let i = 0; i < 12; i++) {
      const before = await p.locator(".question-main h2").innerText();
      await p.locator(".answer-options button").first().click();
      if (i < 11)
        await p.waitForFunction(
          (old) =>
            document.querySelector(".question-main h2")?.textContent !== old,
          before,
        );
      else
        await p
          .getByRole("heading", { name: "Quem acertaria suas respostas?" })
          .waitFor();
    }
    await p.getByRole("checkbox").check();
    await p.getByRole("button", { name: "Preparar meu convite" }).click();
    await p.getByLabel("Seu link", { exact: true }).waitFor();
    const url = await p.getByLabel("Seu link", { exact: true }).inputValue();
    assert.match(url, /juntos/);
    const guest = await pageFor(users[0]);
    await guest.goto(url);
    await guest.getByRole("button", { name: "Aceitar e começar" }).waitFor();
    await guest.getByRole("checkbox").check();
    await guest.getByRole("button", { name: "Aceitar e começar" }).click();
    await guest.locator(".guest-quiz").waitFor();
    assert.ok(
      !(await guest.locator(".guest-quiz").innerText()).includes("Crush"),
      "private relationship",
    );
    for (let i = 0; i < 12; i++) {
      await guest.locator(".answer-options button").first().click();
      await guest
        .getByRole("button", {
          name: i === 11 ? "Confirmar e descobrir" : "Próxima",
        })
        .click();
    }
    await guest
      .getByRole("heading", { name: "12 de 12 escolhas novas antecipadas." })
      .waitFor();
    await p.goto(origin + "/descobertas");
    await p.locator(".expectation-list").waitFor();
    await capture(p, "discoveries-desktop");
    await p.setViewportSize({ width: 390, height: 844 });
    await capture(p, "discoveries-mobile");
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      "discoveries overflow",
    );
    assert.ok(
      (await p.locator(".main-navigation").boundingBox()).y > 700,
      "navigation at viewport bottom",
    );
    await p.goto(origin + "/painel");
    await p.getByRole("heading", { name: /Que bom te ver/ }).waitFor();
    await capture(p, "panel-mobile");
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      "panel overflow",
    );
    await p.setViewportSize({ width: 1440, height: 1000 });
    await capture(p, "panel-desktop");
    await p.goto(origin + "/mundo");
    await p
      .getByRole("heading", {
        name: "A tecnologia vai mudar como acompanhamos o esporte?",
      })
      .waitFor();
    await p.locator(".answer-options button").first().click();
    await p.getByRole("button", { name: "Confirmar minha previsão" }).click();
    await p
      .getByRole("heading", { name: "Quem adivinharia sua previsão?" })
      .waitFor();
    await capture(p, "world-desktop");
    await p.setViewportSize({ width: 390, height: 844 });
    await capture(p, "world-mobile");
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      "world overflow",
    );
    assert.deepEqual(errors, [], "no browser runtime or fixture API errors");
    console.log(
      "PASS browser: owner/guest journey, reveal, discoveries, world prediction, privacy, desktop and mobile layouts. Auth/social/world HTTP fixtures; real Perspectives API and SQL.",
    );
  } finally {
    await browser.close();
  }
}

import { expect, test } from "@playwright/test";

test("foundation page responds and identifies the app", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("ORVOK Social");
  await expect(
    page.getByRole("heading", { name: "Fundação técnica em preparação." }),
  ).toBeVisible();
});

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Browser smoke tests for the current clean-room route surface.
 *
 * The suite is intentionally read-only and wallet-free. It protects the
 * production routes while also asserting that deleted legacy aliases stay gone.
 */

async function clearComplianceGate(page: Page) {
  await page.context().setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
  await page.context().addCookies([
    {
      name: "arbi-locale",
      value: "en",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
    }
  ]);
  await page.addInitScript(() => {
    window.localStorage.setItem("arbigamefi.compliance.age.v1", JSON.stringify(true));
    window.localStorage.setItem(
      "arbigamefi.compliance.terms.v1",
      JSON.stringify({ version: "2026-05-28", acceptedAt: Date.now() })
    );
    window.localStorage.setItem("arbigamefi.compliance.cookies.v1", JSON.stringify("rejected"));
  });
}

async function gotoReady(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "commit" });
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error/i);
  return response;
}

const coreRoutes = [
  { path: "/portfolio", text: "Account" },
  { path: "/portfolio/activity", text: "Casino ledger" },
  { path: "/earn", text: "Liquidity" },
  { path: "/sportsbook", text: "Sportsbook" },
  { path: "/ops", text: "Casino keeper" },
  { path: "/legal/privacy", text: "Privacy" }
] as const;

test.describe("current route smoke", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await clearComplianceGate(page);
  });

  test("marketing homepage exposes canonical product entrypoints", async ({ page }) => {
    await gotoReady(page, "/");

    await expect(page.getByRole("link", { name: "ArbiGameFi" }).first()).toBeVisible();
    await expect(page.locator('a[href="/casino"]').first()).toBeVisible();
    await expect(page.locator('a[href="/earn"]').first()).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("product header points only at current product routes", async ({ page }) => {
    await gotoReady(page, "/casino");
    const header = page.locator("header").first();

    for (const href of [
      "/casino",
      "/sportsbook",
      "/portfolio/activity",
      "/earn",
      "/portfolio/claims"
    ]) {
      await expect(header.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
  });

  test("casino directory filters and navigates to a room", async ({ page }) => {
    await gotoReady(page, "/casino");

    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByTestId("room-entry-card")).toHaveCount(8);

    await page.locator('input[type="text"]').first().fill("roulette");
    await expect(
      page.locator('[data-testid="room-entry-card"][data-slug="roulette"]')
    ).toBeVisible();

    await page.locator('[data-testid="room-entry-card"][data-slug="roulette"]').click();
    await expect(page).toHaveURL(/\/casino\/roulette$/);
    await expect(page.getByRole("heading", { name: /Roulette/i })).toBeVisible();
  });

  for (const route of coreRoutes) {
    test(`core route renders without wallet interaction: ${route.path}`, async ({ page }) => {
      const response = await gotoReady(page, route.path);
      expect(response?.status(), route.path).toBeLessThan(400);
      await expect(page.getByText(route.text).first()).toBeVisible();
    });
  }

  test("legacy route aliases stay physically deleted", async ({ page }) => {
    for (const path of ["/games", "/dice", "/bets", "/privacy"]) {
      const response = await page.goto(path, { waitUntil: "commit" });
      expect(response?.status(), path).toBe(404);
    }
  });
});

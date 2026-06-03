import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Browser smoke tests for the current clean-room route surface.
 *
 * The suite is intentionally read-only and wallet-free. It protects the
 * production routes while also asserting that deleted legacy aliases stay gone.
 */

async function clearComplianceGate(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("arbigamefi.compliance.age.v1", JSON.stringify(true));
    window.localStorage.setItem(
      "arbigamefi.compliance.terms.v1",
      JSON.stringify({ version: "2026-05-28", acceptedAt: Date.now() })
    );
    window.localStorage.setItem("arbigamefi.compliance.cookies.v1", JSON.stringify("rejected"));
  });
}

test.describe("current route smoke", () => {
  test.beforeEach(async ({ page }) => {
    await clearComplianceGate(page);
  });

  test("marketing homepage exposes canonical product entrypoints", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "ArbiGameFi" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Start Playing/i }).first()).toHaveAttribute(
      "href",
      "/casino"
    );
    await expect(page.getByRole("link", { name: /How It Works/i }).first()).toHaveAttribute(
      "href",
      "/earn"
    );
    await expect(page.getByRole("heading", { name: "Game rooms. One wallet." })).toBeVisible();
  });

  test("product header points only at current product routes", async ({ page }) => {
    await page.goto("/casino");
    const header = page.locator("header").first();

    await expect(header.getByRole("link", { name: "Games" })).toHaveAttribute("href", "/casino");
    await expect(header.getByRole("link", { name: "Sportsbook" })).toHaveAttribute(
      "href",
      "/sportsbook"
    );
    await expect(header.getByRole("link", { name: "Bets" })).toHaveAttribute(
      "href",
      "/portfolio/activity"
    );
    await expect(header.getByRole("link", { name: "Liquidity" })).toHaveAttribute("href", "/earn");
    await expect(header.getByRole("link", { name: "Claims" })).toHaveAttribute(
      "href",
      "/portfolio/claims"
    );
  });

  test("casino directory filters and navigates to a room", async ({ page }) => {
    await page.goto("/casino");

    await expect(page.getByRole("heading", { name: "Pick a game." })).toBeVisible();
    await expect(page.getByTestId("room-entry-card")).toHaveCount(8);

    await page.getByLabel("Search games").fill("roulette");
    await expect(page.getByText("European Roulette")).toBeVisible();

    await page.getByRole("link", { name: /European Roulette/i }).click();
    await expect(page).toHaveURL(/\/casino\/roulette$/);
    await expect(page.getByRole("heading", { name: /Roulette/i })).toBeVisible();
  });

  test("core product pages render without wallet interaction", async ({ page }) => {
    const routes = [
      { path: "/portfolio", text: "Account" },
      { path: "/portfolio/activity", text: "Casino ledger" },
      { path: "/earn", text: "Liquidity" },
      { path: "/sportsbook", text: "Sportsbook" },
      { path: "/ops", text: "Casino keeper" },
      { path: "/legal/privacy", text: "Privacy" }
    ];

    for (const route of routes) {
      const response = await page.goto(route.path);
      expect(response?.status(), route.path).toBeLessThan(400);
      await expect(page.getByText(route.text).first()).toBeVisible();
    }
  });

  test("legacy route aliases stay physically deleted", async ({ page }) => {
    for (const path of ["/games", "/dice", "/bets", "/privacy"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });
});

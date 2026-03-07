import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the ArbiGameFi web app.
 *
 * These tests verify basic navigation and page rendering.
 * They do NOT require a wallet connection or on-chain state.
 * Run with: pnpm e2e (dev server must be running on :3000)
 */

test.describe("Smoke tests", () => {
  test("homepage loads with ArbiGameFi brand", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=ArbiGameFi")).toBeVisible();
  });

  test("navigation links are visible on desktop", async ({ page }) => {
    await page.goto("/");
    // Desktop nav links
    const nav = page.locator("header nav").first();
    await expect(nav.locator("text=Games")).toBeVisible();
    await expect(nav.locator("text=Bets")).toBeVisible();
    await expect(nav.locator("text=Liquidity")).toBeVisible();
  });

  test("games page loads", async ({ page }) => {
    await page.goto("/games");
    // Should see either the games grid or a placeholder
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
  });

  test("bets page loads with table headers", async ({ page }) => {
    await page.goto("/bets");
    await expect(page.locator("text=Bets")).toBeVisible();
    // Table headers
    await expect(page.locator("th:has-text('betId')")).toBeVisible();
    await expect(page.locator("th:has-text('state')")).toBeVisible();
  });

  test("navigation between pages works", async ({ page }) => {
    await page.goto("/");

    // Navigate to Games
    await page.locator("header").locator("text=Games").first().click();
    await expect(page).toHaveURL(/\/games/);

    // Navigate to Bets
    await page.locator("header").locator("text=Bets").first().click();
    await expect(page).toHaveURL(/\/bets/);

    // Navigate back to home
    await page.locator("text=ArbiGameFi").first().click();
    await expect(page).toHaveURL("/");
  });

  test("theme toggle button is present", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator('[data-testid="theme-toggle"]');
    await expect(toggle).toBeVisible();
  });

  test("dark mode toggles the .dark class", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator('[data-testid="theme-toggle"]');

    // Click once → should go to light (default is system, first click = light)
    // Actually: default is "system", cycle is system→light→dark→system
    // So first click from system → light
    await toggle.click();

    // Click again → dark
    await toggle.click();
    const hasDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(hasDark).toBe(true);
  });

  test("mobile menu toggle works on narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Desktop nav should be hidden
    const desktopNav = page.locator("header nav.md\\:flex");
    // The hamburger should be visible
    const hamburger = page.locator('[aria-label="Toggle navigation menu"]');
    await expect(hamburger).toBeVisible();

    // Click hamburger to open mobile nav
    await hamburger.click();

    // Mobile nav links should now be visible
    const mobileNav = page.locator("header nav.md\\:hidden");
    await expect(mobileNav.locator("text=Games")).toBeVisible();
  });
});

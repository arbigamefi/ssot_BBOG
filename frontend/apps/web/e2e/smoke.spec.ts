import { expect, test } from "@playwright/test";
import { embeddedChainIds } from "@ssot/ssot/release";
import { clearComplianceGate, coreRoutes, expectRouteContent, gotoReady } from "./route-helpers";

/**
 * Browser smoke tests for the production routes.
 *
 * The suite is intentionally read-only and wallet-free.
 */

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

  test("wallet selector reaches the real MetaMask download QR without crashing", async ({
    page
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await gotoReady(page, "/");
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Connect wallet", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    // Use the built-in download flow: it exercises the same real QR renderer
    // as live pairing, without depending on a relay or requesting accounts.
    await dialog.getByRole("button", { name: "Get a Wallet", exact: true }).click();
    await dialog.getByRole("button", { name: "GET", exact: true }).first().click();
    await expect(dialog.getByRole("link", { name: "Add to Chrome" })).toHaveAttribute(
      "href",
      /chrome\.google\.com\/webstore\/detail\/metamask\//
    );
    await dialog.getByRole("button", { name: "Get the app", exact: true }).click();
    await expect(
      dialog.getByText("Scan with your phone to download on iOS or Android", { exact: true })
    ).toBeVisible();
    await expect(dialog.getByRole("img", { name: "QR Code", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("the header carries the one site navigation", async ({ page }) => {
    await gotoReady(page, "/casino");
    const nav = page.getByRole("banner").getByRole("navigation", { name: "Main" });
    const links = nav.getByRole("link");
    await expect(links).toHaveText(["Casino", "Liquidity", "Rewards", "Help"]);
    for (const [index, href] of ["/casino", "/earn", "/affiliate", "/support"].entries()) {
      await expect(links.nth(index)).toHaveAttribute("href", href);
    }
    // Ops is linked from the footer only.
    await expect(page.getByRole("banner").locator('a[href="/ops"]')).toHaveCount(0);
    await expect(page.getByRole("contentinfo").locator('a[href="/ops"]')).toBeVisible();
  });

  test("casino directory requires a release before exposing rooms", async ({ page }) => {
    await gotoReady(page, "/casino");

    if (embeddedChainIds.length === 0) {
      await expect(page.getByRole("status").getByText("Read-only", { exact: true })).toBeVisible();
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { name: "Games", exact: true })).toBeVisible();
      await expect(main.getByText(/^No embedded release for chainId=\d+$/)).toBeVisible();
      await expect(page.getByTestId("room-entry-card")).toHaveCount(0);
      await expect(main.locator("input")).toHaveCount(0);
      return;
    }

    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByTestId("room-entry-card")).toHaveCount(8);

    await page.locator('input[type="text"]').first().fill("roulette");
    await expect(
      page.locator('[data-testid="room-entry-card"][data-slug="roulette"]')
    ).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/casino\/roulette$/),
      page
        .locator('[data-testid="room-entry-card"][data-slug="roulette"]')
        .click({ noWaitAfter: true })
    ]);
    await expect(page).toHaveURL(/\/casino\/roulette$/);
    await expect(page.getByRole("heading", { name: /Roulette/i })).toBeVisible();
  });

  for (const route of coreRoutes) {
    test(`core route renders without wallet interaction: ${route.path}`, async ({ page }) => {
      await gotoReady(page, route.path);
      await expectRouteContent(page, route);
    });
  }
});

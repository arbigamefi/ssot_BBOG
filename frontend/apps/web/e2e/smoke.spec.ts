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
    await page.getByRole("button", { name: "Connect Wallet", exact: true }).click();
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

  test("product header points only at current product routes", async ({ page }) => {
    await gotoReady(page, "/casino");
    const header = page.locator("header").first();

    for (const href of ["/casino", "/portfolio/activity", "/earn", "/portfolio/claims"]) {
      await expect(header.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
  });

  test("casino lobby requires a release before printing game stubs", async ({ page }) => {
    await gotoReady(page, "/casino");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: "Pick a game." })).toBeVisible();
    const stubs = main.locator("li[data-slug]");

    if (embeddedChainIds.length === 0) {
      await expect(main.getByText("Games aren't available on this network yet.")).toBeVisible();
      await expect(stubs).toHaveCount(0);
      return;
    }

    await expect(stubs).toHaveCount(8);
    await expect(main.getByText(/Win chance 2% to 97%\./)).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/casino\/roulette$/),
      main.locator('li[data-slug="roulette"] a').click({ noWaitAfter: true })
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

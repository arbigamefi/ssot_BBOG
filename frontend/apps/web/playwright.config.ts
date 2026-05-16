import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for SSOT v2 web app.
 *
 * Usage:
 *   pnpm e2e          - run all E2E tests headless
 *   pnpm e2e:ui       - open Playwright UI for interactive runs
 *
 * The dev server must be running (port 3000) or set CI=true to
 * let Playwright start it automatically.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const webServerPort = new URL(baseURL).port || "3000";
const ciWebServerCommand =
  process.env.PLAYWRIGHT_USE_EXISTING_BUILD === "1"
    ? `PORT=${webServerPort} pnpm start`
    : `pnpm build && PORT=${webServerPort} pnpm start`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: process.env.CI
    ? {
        command: ciWebServerCommand,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000
      }
    : undefined
});

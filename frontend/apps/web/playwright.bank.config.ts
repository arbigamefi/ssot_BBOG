import { defineConfig, devices } from "@playwright/test";
if (!process.env.BANK_ANVIL_RPC || !process.env.BANK_E2E_STATE) {
  throw new Error("Run script/ci/bank_wallet_e2e.sh; this suite requires its isolated node.");
}
export default defineConfig({
  testDir: "./e2e",
  testMatch: "bank-wallet.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    actionTimeout: 15_000,
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});

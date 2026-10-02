import { expect, type Page } from "@playwright/test";
import { embeddedChainIds } from "@ssot/ssot/release";

const hasRelease = embeddedChainIds.length > 0;

export const coreRoutes = [
  { path: "/portfolio", heading: hasRelease ? "Wallet profile." : "Portfolio" },
  { path: "/portfolio/activity", heading: "Betting activity." },
  { path: "/earn", heading: hasRelease ? /^Provide payout capital to the .+ pool\.$/ : "Pools" },
  { path: "/sportsbook", heading: hasRelease ? "Sportsbook" : "Sportsbook is in preview" },
  { path: "/ops", heading: "Release and worker pulse." },
  { path: "/legal/privacy", heading: "Privacy Policy" }
] as const;

export const accessibilityRoutes = [
  { path: "/", heading: "On-chain games. Verifiable results." },
  { path: "/casino", heading: hasRelease ? "Pick a game." : "Games" },
  { path: "/casino/dice", heading: hasRelease ? "Dice" : "Game not found" },
  ...coreRoutes
] as const;

export async function useEnglishLocale(page: Page) {
  await page.context().setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
  await page.context().addCookies([
    {
      name: "arbi-locale",
      value: "en",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
    }
  ]);
}

export async function clearComplianceGate(page: Page) {
  await useEnglishLocale(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("arbigamefi.compliance.age.v1", JSON.stringify(true));
    window.localStorage.setItem(
      "arbigamefi.compliance.terms.v1",
      JSON.stringify({ version: "2026-05-28", acceptedAt: Date.now() })
    );
    window.localStorage.setItem("arbigamefi.compliance.cookies.v1", JSON.stringify("rejected"));
    // Route checks exercise the content beneath the separate first-visit overlays.
    window.localStorage.setItem("arbigamefi.onboarding.v1", "done");
  });
}

export async function gotoReady(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "commit" });
  expect(response?.status(), path).toBeLessThan(400);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /Application error|Internal Server Error|Something went wrong/i
  );
  return response;
}

export async function expectRouteContent(
  page: Page,
  route: { path: string; heading: string | RegExp }
) {
  await expect(
    page.getByRole("main").getByRole("heading", { name: route.heading, exact: true })
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("nextjs-portal")).toHaveCount(0);
}

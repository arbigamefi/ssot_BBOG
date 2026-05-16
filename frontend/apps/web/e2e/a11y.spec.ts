import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Result } from "axe-core";

const ROUTES = [
  "/",
  "/casino",
  "/casino/dice",
  "/portfolio",
  "/portfolio/activity",
  "/earn",
  "/sportsbook",
  "/ops",
  "/legal/privacy"
] as const;

test.describe("accessibility smoke", () => {
  for (const route of ROUTES) {
    test(`${route} has no serious or critical axe violations`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status(), route).toBeLessThan(400);
      await expect(page.locator("body")).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const blockingViolations = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical"
      );

      expect(blockingViolations.length, formatViolations(route, blockingViolations)).toBe(0);
    });
  }
});

function formatViolations(route: string, violations: Result[]) {
  if (!violations.length) return `${route} has no blocking accessibility violations`;

  return violations
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 4)
        .map((node) => node.target.join(" "))
        .join(", ");
      return `${route}: ${violation.id} [${violation.impact}] ${violation.help} (${targets})`;
    })
    .join("\n");
}

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Result } from "axe-core";
import {
  accessibilityRoutes,
  clearComplianceGate,
  expectRouteContent,
  gotoReady,
  useEnglishLocale
} from "./route-helpers";

test.describe("accessibility smoke", () => {
  for (const route of accessibilityRoutes) {
    test(`${route.path} content has no serious or critical axe violations`, async ({ page }) => {
      await clearComplianceGate(page);
      await gotoReady(page, route.path);
      await expectRouteContent(page, route);
      await expectAccessible(page, route.path);
    });
  }

  test("first-visit compliance gate has no serious or critical axe violations", async ({
    page
  }) => {
    await useEnglishLocale(page);
    await gotoReady(page, "/casino");
    const gate = page.getByRole("dialog", { name: "Before you enter", exact: true });
    await expect(gate).toBeVisible();
    await expect(gate.getByRole("checkbox")).toHaveCount(3);
    await expectAccessible(page, "/casino compliance gate");
  });
});

async function expectAccessible(page: Page, route: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blockingViolations = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
  expect(blockingViolations.length, formatViolations(route, blockingViolations)).toBe(0);
}

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

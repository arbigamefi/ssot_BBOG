import { describe, expect, it } from "vitest";

import { CASINO_GAME_PRESENTATION, getCasinoGamePresentation } from "./game-presentation";
import { CASINO_MODULE_SLUGS } from "./modules";

describe("casino game presentation", () => {
  it("covers every registered casino module", () => {
    expect(Object.keys(CASINO_GAME_PRESENTATION).sort()).toEqual([...CASINO_MODULE_SLUGS].sort());
    for (const slug of CASINO_MODULE_SLUGS) {
      const presentation = getCasinoGamePresentation(slug);
      expect(presentation?.visualKind).toBe(slug);
      expect(presentation?.ogTitle).not.toContain("8");
      expect(presentation?.ogSubtitle).not.toContain("8");
    }
  });

  it("keeps OG stats away from house-edge or multiplier claims", () => {
    for (const card of Object.values(CASINO_GAME_PRESENTATION)) {
      expect(card.ogStat).not.toMatch(/\bhouse edge\b|%|×|\b\d+(?:\.\d+)?x\b/i);
    }
  });
});

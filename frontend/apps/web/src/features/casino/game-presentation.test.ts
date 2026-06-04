import { describe, expect, it } from "vitest";

import { CASINO_MODULE_SLUGS } from "./modules";
import { CASINO_GAME_PRESENTATION, getCasinoGamePresentation } from "./game-presentation";

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
});

import { describe, expect, it } from "vitest";

import {
  CASINO_MODULES,
  CASINO_MODULE_SLUGS,
  compareCasinoModules,
  getCasinoModule,
  isCasinoModuleSlug
} from ".";

describe("casino module registry", () => {
  it("registers one canonical entry for every supported casino module", () => {
    expect(CASINO_MODULES).toHaveLength(CASINO_MODULE_SLUGS.length);
    expect(new Set(CASINO_MODULES.map((module) => module.slug)).size).toBe(CASINO_MODULES.length);

    for (const module of CASINO_MODULES) {
      expect(module.canonicalHref).toBe(`/casino/${module.slug}`);
      expect(module.label).toBeTruthy();
      expect(module.roomLabel).toBeTruthy();
    }
  });

  it("narrows known slugs and rejects unknown modules", () => {
    expect(isCasinoModuleSlug("roulette")).toBe(true);
    expect(isCasinoModuleSlug("sportsbook")).toBe(false);
    expect(getCasinoModule("dice")?.contractParams).toBe("dice-threshold");
    expect(getCasinoModule("plinko")?.contractParams).toBe("plinko-risk");
    expect(getCasinoModule("sportsbook")).toBeUndefined();
  });

  it("keeps canonical modules ahead of release-only metadata", () => {
    const ordered = [
      { slug: "custom", label: "Custom" },
      { slug: "keno", label: "Keno" },
      { slug: "plinko", label: "Plinko" },
      { slug: "roulette", label: "Roulette" }
    ].sort(compareCasinoModules);

    expect(ordered.map((item) => item.slug)).toEqual(["roulette", "keno", "plinko", "custom"]);
  });
});

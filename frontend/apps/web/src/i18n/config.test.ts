import { describe, expect, it } from "vitest";

import { localeFromAcceptLanguage, normalizeLocale } from "./config";
import { buildPageMetadata } from "./metadata";
import { getMessages } from "./messages";

describe("i18n config", () => {
  it("normalizes supported locale aliases", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("zh")).toBe("zh-Hans");
    expect(normalizeLocale("zh-CN")).toBe("zh-Hans");
    expect(normalizeLocale("pt")).toBe("pt-BR");
    expect(normalizeLocale("pt-BR")).toBe("pt-BR");
    expect(normalizeLocale("ru")).toBe("ru");
    expect(normalizeLocale("tr")).toBe("tr");
  });

  it("resolves accept-language in preference order", () => {
    expect(localeFromAcceptLanguage("fr-FR,zh-CN;q=0.9,en;q=0.8")).toBe("zh-Hans");
    expect(localeFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("pt-BR,pt;q=0.9,en;q=0.8")).toBe("pt-BR");
    expect(localeFromAcceptLanguage("ru-RU,ru;q=0.9")).toBe("ru");
    expect(localeFromAcceptLanguage("tr-TR,tr;q=0.8")).toBe("tr");
  });

  it("falls back to English for untranslated keys via deep-merge", () => {
    // ops.* is intentionally left English; a non-en locale must still resolve
    // it via deep-merge fallback rather than throwing or returning undefined.
    const pt = getMessages("pt-BR") as Record<string, any>;
    expect(typeof pt.ops).toBe("object");
    // A translated Tier-1 key should be localized, not the English string.
    expect(pt.nav.games).not.toBe((getMessages("en") as Record<string, any>).nav.games);
  });

  it("builds localized route metadata with dynamic values", () => {
    expect(buildPageMetadata(getMessages("en"), "casinoRoom", { game: "Dice" })).toMatchObject({
      title: "Dice",
      description: expect.stringContaining("Dice")
    });
    expect(
      buildPageMetadata(getMessages("zh-Hans"), "sportsbookMarket", { marketId: "7" })
    ).toMatchObject({
      title: "体育市场 7",
      description: expect.stringContaining("7")
    });
  });
});

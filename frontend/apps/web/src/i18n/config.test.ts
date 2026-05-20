import { describe, expect, it } from "vitest";

import { localeFromAcceptLanguage, normalizeLocale } from "./config";
import { buildPageMetadata } from "./metadata";
import { getMessages } from "./messages";

describe("i18n config", () => {
  it("normalizes supported locale aliases", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("zh")).toBe("zh-Hans");
    expect(normalizeLocale("zh-CN")).toBe("zh-Hans");
  });

  it("resolves accept-language in preference order", () => {
    expect(localeFromAcceptLanguage("fr-FR,zh-CN;q=0.9,en;q=0.8")).toBe("zh-Hans");
    expect(localeFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
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

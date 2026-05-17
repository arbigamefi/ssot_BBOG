import { describe, expect, it } from "vitest";

import { localeFromAcceptLanguage, normalizeLocale } from "./config";

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
});

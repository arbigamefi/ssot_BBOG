import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

import en from "../../i18n/locales/en/common.json";
import ptBR from "../../i18n/locales/pt-BR/common.json";
import ru from "../../i18n/locales/ru/common.json";
import tr from "../../i18n/locales/tr/common.json";
import zhHans from "../../i18n/locales/zh-Hans/common.json";
import { EarnRiskPanel } from "./earn-risk-panel";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

afterEach(cleanup);

type PoolRules = { title: string; items: Record<string, string>; more: string };

type LocaleName = "en" | "zh-Hans" | "pt-BR" | "ru" | "tr";

const LOCALES = { en, "zh-Hans": zhHans, "pt-BR": ptBR, ru, tr } as unknown as Record<
  LocaleName,
  { earn: { nft: { poolRules: PoolRules } } }
>;

describe("EarnRiskPanel", () => {
  it("lists the pool rules and links to the full risk disclaimer", () => {
    render(<EarnRiskPanel decimals={6} symbol="USDC" />);

    expect(screen.getByRole("heading", { name: "earn.nft.poolRules.title" })).toBeDefined();
    for (const index of [0, 1, 2, 3, 4]) {
      expect(screen.getByText(`earn.nft.poolRules.items.${index}`)).toBeDefined();
    }
    expect(screen.getByRole("link", { name: "earn.nft.poolRules.more" }).getAttribute("href")).toBe(
      "/legal/disclaimer"
    );
  });

  it.each(Object.keys(LOCALES) as LocaleName[])("states every pool rule in %s", (locale) => {
    const rules = LOCALES[locale].earn.nft.poolRules;
    const english = LOCALES.en.earn.nft.poolRules;
    expect(Object.keys(rules.items)).toEqual(["0", "1", "2", "3", "4"]);
    for (const text of [rules.title, rules.more, ...Object.values(rules.items)]) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
    if (locale !== "en") {
      for (const [index, item] of Object.entries(rules.items)) {
        expect(item).not.toBe(english.items[index]);
      }
    }
  });
});

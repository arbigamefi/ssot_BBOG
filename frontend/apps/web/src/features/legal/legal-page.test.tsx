import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

import en from "../../i18n/locales/en/common.json";
import ptBR from "../../i18n/locales/pt-BR/common.json";
import ru from "../../i18n/locales/ru/common.json";
import tr from "../../i18n/locales/tr/common.json";
import zhHans from "../../i18n/locales/zh-Hans/common.json";
import { LEGAL_LAYOUT, LEGAL_SLUGS, type LegalSlug } from "./content";
import { LegalPage } from "./legal-page";

type LegalPageCopy = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: Record<string, string>;
  sections: Record<string, { title: string; body: string }>;
};

type LocaleName = "en" | "zh-Hans" | "pt-BR" | "ru" | "tr";

const LOCALES = { en, "zh-Hans": zhHans, "pt-BR": ptBR, ru, tr } as unknown as Record<
  LocaleName,
  { legal: { pages: Record<LegalSlug, LegalPageCopy> } }
>;

function keys(count: number) {
  return Array.from({ length: count }, (_, index) => String(index));
}

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("next-intl", async () => {
  const messages = (await import("../../i18n/locales/en/common.json")).default as Record<
    string,
    unknown
  >;

  function resolveMessage(key: string) {
    return key.split(".").reduce<unknown>((value, part) => {
      if (value && typeof value === "object" && part in value) {
        return (value as Record<string, unknown>)[part];
      }
      return undefined;
    }, messages);
  }

  function translate(key: string) {
    const message = resolveMessage(`legal.${key}`);
    return typeof message === "string" ? message : key;
  }

  return {
    useTranslations: () => translate
  };
});

afterEach(cleanup);

describe("LegalPage", () => {
  it("renders the active legal document and peer navigation", () => {
    render(<LegalPage slug="terms" />);

    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeDefined();
    expect(screen.getByText("Use of the frontend")).toBeDefined();
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe(
      "/legal/privacy"
    );
    expect(screen.getByRole("link", { name: "Risk disclaimer" }).getAttribute("href")).toBe(
      "/legal/disclaimer"
    );
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("aria-current")).toBe("page");
  });

  it("keeps risk content in the disclaimer surface", () => {
    render(<LegalPage slug="disclaimer" />);

    expect(screen.getByRole("heading", { name: "Risk Disclaimer" })).toBeDefined();
    expect(screen.getByText("Protocol risk")).toBeDefined();
    expect(screen.getByText("Outcome and settlement risk")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Exits during an incident" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Asset issuer" })).toBeDefined();
  });

  it("renders every configured section of the terms, from bets and voids to governance", () => {
    render(<LegalPage slug="terms" />);

    for (const name of [
      "Bets and limits",
      "Results, refunds and voids",
      "Who decides about voids",
      "Pauses and stopped games",
      "Governance and changes",
      "Providing liquidity",
      "No universal availability"
    ]) {
      expect(screen.getByRole("heading", { name })).toBeDefined();
    }
    // One heading per section plus the key points.
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(
      LEGAL_LAYOUT.terms.sections + 1
    );
  });

  it.each(Object.keys(LOCALES) as LocaleName[])(
    "translates every legal page in full in %s",
    (locale) => {
      const pages = LOCALES[locale].legal.pages;
      const english = LOCALES.en.legal.pages;
      for (const slug of LEGAL_SLUGS) {
        const page = pages[slug];
        expect(Object.keys(page.highlights)).toEqual(keys(LEGAL_LAYOUT[slug].highlights));
        expect(Object.keys(page.sections)).toEqual(keys(LEGAL_LAYOUT[slug].sections));
        const texts = [
          page.eyebrow,
          page.title,
          page.description,
          ...Object.values(page.highlights),
          ...Object.values(page.sections).flatMap((section) => [section.title, section.body])
        ];
        for (const text of texts) expect(text.trim().length).toBeGreaterThan(0);
        if (locale !== "en") {
          // A copied English body would mean the page silently shows English.
          for (const [index, section] of Object.entries(page.sections)) {
            expect(section.body).not.toBe(english[slug].sections[index]?.body);
          }
        }
      }
    }
  );
});

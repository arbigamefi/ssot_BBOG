import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";

import { LegalPage } from "./legal-page";

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
  });
});

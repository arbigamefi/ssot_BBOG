import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AgeTermsGate,
  ComplianceProvider,
  CookieConsentBanner,
  SelfExclusionGate,
  useCompliance
} from "./index";

vi.mock("@ssot/ui", () => ({
  cn: (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" "),
  toast: { warning: vi.fn(), error: vi.fn() }
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

let mockPathname = "/casino/dice";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname
}));

vi.mock("@heroicons/react/24/outline", () => ({
  ShieldCheckIcon: () => <svg />,
  NoSymbolIcon: () => <svg />,
  XMarkIcon: () => <svg />
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    // Echo the leaf key so assertions can target stable text.
    const leaf = key.split(".").pop() ?? key;
    if (values && Object.keys(values).length > 0) {
      return `${leaf}:${Object.values(values).join(",")}`;
    }
    return leaf;
  }
}));

function Harness({ children }: { children: React.ReactNode }) {
  return <ComplianceProvider>{children}</ComplianceProvider>;
}

describe("compliance", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPathname = "/casino/dice";
  });
  afterEach(() => cleanup());

  it("blocks entry until age + jurisdiction + terms are all accepted", () => {
    render(
      <Harness>
        <AgeTermsGate />
      </Harness>
    );

    // Gate is visible.
    expect(screen.getByRole("dialog")).toBeDefined();
    const enter = screen.getByRole("button", { name: "enter" });
    expect((enter as HTMLButtonElement).disabled).toBe(true);

    // Check all three boxes.
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(3);
    checkboxes.forEach((box) => fireEvent.click(box));

    expect((screen.getByRole("button", { name: "enter" }) as HTMLButtonElement).disabled).toBe(
      false
    );

    // Accept → gate disappears + persisted.
    fireEvent.click(screen.getByRole("button", { name: "enter" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.localStorage.getItem("arbigamefi.compliance.age.v1")).toBe("true");
  });

  it("does NOT gate the homepage or legal pages (no catch-22 reading the Terms)", () => {
    // Homepage — public landing, never gated.
    mockPathname = "/";
    const { unmount } = render(
      <Harness>
        <AgeTermsGate />
      </Harness>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();

    // Legal terms page — must be readable so the visitor can accept it.
    mockPathname = "/legal/terms";
    render(
      <Harness>
        <AgeTermsGate />
      </Harness>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does gate casino + sportsbook wager routes", () => {
    for (const route of ["/casino", "/casino/roulette", "/sportsbook", "/sportsbook/x"]) {
      cleanup();
      mockPathname = route;
      render(
        <Harness>
          <AgeTermsGate />
        </Harness>
      );
      expect(screen.queryByRole("dialog")).not.toBeNull();
    }
  });

  it("keeps analytics consent null until the cookie banner is actioned", () => {
    function Probe() {
      const { cookieConsent } = useCompliance();
      return <span data-testid="consent">{String(cookieConsent)}</span>;
    }
    // Pre-clear entry so the cookie banner shows.
    window.localStorage.setItem("arbigamefi.compliance.age.v1", "true");
    window.localStorage.setItem(
      "arbigamefi.compliance.terms.v1",
      JSON.stringify({ version: "2026-05-28", acceptedAt: 1 })
    );

    render(
      <Harness>
        <Probe />
        <CookieConsentBanner />
      </Harness>
    );

    expect(screen.getByTestId("consent").textContent).toBe("null");
    fireEvent.click(screen.getByRole("button", { name: "accept" }));
    expect(screen.getByTestId("consent").textContent).toBe("accepted");
  });

  it("hard-blocks wager routes when self-excluded", () => {
    // Seed an active self-exclusion.
    window.localStorage.setItem("arbigamefi.compliance.age.v1", "true");
    window.localStorage.setItem(
      "arbigamefi.compliance.terms.v1",
      JSON.stringify({ version: "2026-05-28", acceptedAt: 1 })
    );
    window.localStorage.setItem(
      "arbigamefi.compliance.rg.v1",
      JSON.stringify({ selfExcludedUntil: Date.now() + 60_000 })
    );

    render(
      <Harness>
        <SelfExclusionGate>
          <div data-testid="game">game content</div>
        </SelfExclusionGate>
      </Harness>
    );

    // The game content must NOT render; the block screen does.
    expect(screen.queryByTestId("game")).toBeNull();
    expect(screen.getByText("title")).toBeDefined();
  });

  it("lets wager routes through when the exclusion has expired", () => {
    window.localStorage.setItem(
      "arbigamefi.compliance.rg.v1",
      JSON.stringify({ selfExcludedUntil: Date.now() - 1000 })
    );

    render(
      <Harness>
        <SelfExclusionGate>
          <div data-testid="game">game content</div>
        </SelfExclusionGate>
      </Harness>
    );

    expect(screen.getByTestId("game")).toBeDefined();
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import * as React from "react";

import en from "../i18n/locales/en/common.json";
import { AppShell } from "./AppShell";

const state = {
  pathname: "/earn",
  readOnly: false
};

vi.mock("../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({
    readOnly: state.readOnly,
    readOnlyReason: null,
    warnings: [],
    chainId: 84532
  })
}));

// The wallet control has its own tests; here it only has to be in the bar.
vi.mock("./WalletHeaderMenu", () => ({
  WalletHeaderMenu: () => <button type="button">Connect wallet</button>
}));

vi.mock("./MobileWalletEntryProvider", () => ({
  MobileWalletEntryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("./CasinoAvailabilityNotice", () => ({ CasinoAvailabilityNotice: () => null }));

const openRgDialog = vi.fn();
vi.mock("./compliance", () => ({
  AgeTermsGate: () => null,
  CookieConsentBanner: () => null,
  ResponsibleGamblingDialog: () => null,
  RealityCheckTimer: () => null,
  SelfExclusionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCompliance: () => ({ openRgDialog })
}));

vi.mock("./onboarding/OnboardingTour", () => ({ OnboardingTour: () => null }));
vi.mock("./pwa/InstallPrompt", () => ({ InstallPrompt: () => null }));

/** The English messages, read the way next-intl reads them. */
function message(path: string) {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], en);
}
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (namespace?: string) => {
    const lookup = (key: string) => {
      const value = message(namespace ? `${namespace}.${key}` : key);
      return typeof value === "string" ? value : key;
    };
    const t = (key: string) => lookup(key);
    t.rich = (key: string, tags: Record<string, (chunks: React.ReactNode) => React.ReactNode>) =>
      lookup(key)
        .split(/(<\w+>[^<]*<\/\w+>)/)
        .map((part, index) => {
          const tag = /^<(\w+)>([^<]*)<\/\1>$/.exec(part);
          return tag ? (
            <React.Fragment key={index}>{tags[tag[1]!]?.(tag[2])}</React.Fragment>
          ) : (
            part
          );
        });
    return t;
  }
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ refresh: vi.fn() })
}));

function renderShell() {
  return render(
    <AppShell>
      <p>page content</p>
    </AppShell>
  );
}

function linksIn(element: HTMLElement) {
  return within(element)
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
    state.pathname = "/earn";
    state.readOnly = false;
  });

  it("puts one navigation bar on carbon above the page", () => {
    renderShell();
    const header = screen.getByRole("banner");
    expect(header.className).toContain("bg-carbon");
    expect(within(header).getByRole("link", { name: "ArbiGameFi" }).getAttribute("href")).toBe("/");
    expect(linksIn(screen.getByRole("navigation", { name: "Main" }))).toEqual([
      ["Casino", "/casino"],
      ["Liquidity", "/earn"],
      ["Rewards", "/affiliate"],
      ["Help", "/support"]
    ]);
    expect(within(header).getByRole("button", { name: "Language: English" })).toBeDefined();
    expect(within(header).getByRole("button", { name: "Connect wallet" })).toBeDefined();
    // The player's own pages live in the wallet menu, and Ops only in the footer.
    expect(
      within(header).queryByRole("link", { name: /Portfolio|Bets|Claims|Operations/ })
    ).toBeNull();
  });

  it("marks the page and the section the reader is in", () => {
    renderShell();
    const main = () => screen.getByRole("navigation", { name: "Main" });
    expect(
      within(main()).getByRole("link", { name: "Liquidity" }).getAttribute("aria-current")
    ).toBe("page");
    cleanup();

    state.pathname = "/casino/dice";
    renderShell();
    expect(within(main()).getByRole("link", { name: "Casino" }).getAttribute("aria-current")).toBe(
      "true"
    );
    expect(
      within(main()).getByRole("link", { name: "Liquidity" }).getAttribute("aria-current")
    ).toBeNull();
  });

  it("opens the same sections and the languages from the phone menu", () => {
    renderShell();
    const opener = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(opener);

    const menu = screen.getByRole("dialog", { name: "Menu" });
    expect(linksIn(within(menu).getByRole("navigation", { name: "Main" }))).toEqual([
      ["Casino", "/casino"],
      ["Liquidity", "/earn"],
      ["Rewards", "/affiliate"],
      ["Help", "/support"]
    ]);
    expect(within(menu).getByRole("button", { name: "简体中文" }).getAttribute("lang")).toBe(
      "zh-Hans"
    );
    expect(within(menu).getByRole("button", { name: "English" }).getAttribute("aria-current")).toBe(
      "true"
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
  });

  it("opens the language list from the bar and closes it on Escape", () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: "Language: English" });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Русский" })).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("groups the footer links by reader on carbon-deep", () => {
    renderShell();
    const footer = screen.getByRole("contentinfo");
    expect(footer.className).toContain("bg-carbon-deep");
    const group = (name: string) => linksIn(within(footer).getByRole("region", { name }));
    expect(group("Play")).toEqual([["Casino", "/casino"]]);
    expect(group("Liquidity")).toEqual([
      ["Liquidity", "/earn"],
      ["System status", "/status"]
    ]);
    expect(group("Help")).toEqual([
      ["Support", "/support"],
      ["Terms", "/legal/terms"],
      ["Privacy", "/legal/privacy"],
      ["Disclaimer", "/legal/disclaimer"]
    ]);
    expect(group("Official channels")).toEqual([
      ["Telegram", "https://t.me/arbigamefi"],
      ["X (@arbi_game_fi)", "https://x.com/arbi_game_fi"]
    ]);
    expect(within(footer).getByRole("link", { name: "Operations" }).getAttribute("href")).toBe(
      "/ops"
    );
    expect(within(footer).getByText(/not offered in restricted regions/)).toBeDefined();
    expect(within(footer).getByText("18 or older only")).toBeDefined();

    fireEvent.click(within(footer).getByRole("button", { name: "Responsible gambling" }));
    expect(openRgDialog).toHaveBeenCalledOnce();
  });

  it("runs a page rebuilt in Carbon copy edge to edge, with the footer", () => {
    state.pathname = "/casino/dice";
    const { container } = renderShell();
    expect(container.firstElementChild?.className).toContain("bg-carbon");
    expect(container.firstElementChild?.className).not.toContain("theme-dark");
    expect(screen.getByRole("main").className).toContain("max-w-none");
    expect(screen.getByRole("contentinfo")).toBeDefined();
  });

  it("keeps the old tokens and the bet bar in place of the footer in a room not yet rebuilt", () => {
    state.pathname = "/casino/roulette";
    const { container } = renderShell();
    expect(container.firstElementChild?.className).toContain("theme-dark");
    expect(screen.getByRole("banner").className).toContain("bg-carbon");
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("keeps the skip link and the read-only banner", () => {
    state.readOnly = true;
    renderShell();
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe(
      "#main-content"
    );
    const banner = screen.getByRole("status");
    expect(banner.textContent).toContain("Read-only");
    expect(banner.textContent).toContain("Writes are disabled.");
    expect(screen.getByText("page content")).toBeDefined();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

vi.mock("next/navigation", () => ({ usePathname: () => "/casino/dice" }));

vi.mock("next-intl", async () => {
  const messages = (await import("../i18n/locales/en/common.json")).default as Record<
    string,
    unknown
  >;
  return {
    useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) => {
      const message = `${namespace}.${key}`
        .split(".")
        .reduce<unknown>(
          (value, part) =>
            value && typeof value === "object"
              ? (value as Record<string, unknown>)[part]
              : undefined,
          messages
        );
      if (typeof message !== "string") return key;
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, value),
        message
      );
    }
  };
});

import { CasinoAvailabilityNotice } from "./CasinoAvailabilityNotice";

describe("CasinoAvailabilityNotice", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("points to the launch channel until the website opens betting", () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "false");
    render(<CasinoAvailabilityNotice chainId={84532} />);
    expect(screen.getByText("Betting isn't open yet")).toBeDefined();
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://t.me/arbigamefi");
  });

  it("says an open test chain uses test USDC and links the faucet", () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
    render(<CasinoAvailabilityNotice chainId={84532} />);
    expect(screen.getByText(/test USDC on Base Sepolia, which has no value/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Get test USDC" }).getAttribute("href")).toBe(
      "https://faucet.circle.com"
    );
  });

  it("shows nothing once betting is open on a main chain", () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
    const { container } = render(<CasinoAvailabilityNotice chainId={8453} />);
    expect(container.textContent).toBe("");
  });
});

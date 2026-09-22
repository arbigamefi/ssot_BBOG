import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

import { PortfolioHero } from "./portfolio-hero";

const requestWalletConnect = vi.fn();

vi.mock("../../../app-shell/wallet-connect-events", () => ({
  requestWalletConnect: () => requestWalletConnect()
}));

vi.mock("@heroicons/react/24/outline", () => ({
  IdentificationIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  ),
  ShieldCheckIcon: ({ className }: { className?: string }) => (
    <svg aria-hidden="true" className={className} />
  )
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "portfolio.overview.hero.eyebrow": "Account overview",
      "portfolio.overview.hero.title": "Wallet profile",
      "portfolio.overview.hero.description": "Balances and recent play.",
      "portfolio.overview.hero.connectedAccount": "Connected account",
      "portfolio.overview.common.walletRequired": "Wallet required",
      "app.connectWalletButton": "Connect wallet"
    })[key] ?? key
}));

const metrics = [{ label: "Balance", value: "—", detail: "wallet" }] as const;

describe("PortfolioHero", () => {
  afterEach(() => {
    cleanup();
    requestWalletConnect.mockClear();
  });

  it("offers a connect action instead of claiming an account is connected", () => {
    // Previously this card read "connected account: pending" with no wallet --
    // the opposite of the truth, and it looked like a loading state rather than
    // something to act on. The page also offered no way to connect; the only
    // entry point was the small header button.
    render(<PortfolioHero account="—" connected={false} metrics={metrics} />);

    expect(screen.queryByText("Connected account")).toBeNull();
    expect(screen.getByText("Wallet required")).toBeDefined();

    const cta = screen.getByRole("button", { name: "Connect wallet" });
    fireEvent.click(cta);
    expect(requestWalletConnect).toHaveBeenCalledTimes(1);
  });

  it("shows the address and no connect action once connected", () => {
    render(<PortfolioHero account="0x1234...abcd" connected metrics={metrics} />);

    expect(screen.getByText("Connected account")).toBeDefined();
    expect(screen.getByText("0x1234...abcd")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Connect wallet" })).toBeNull();
    expect(screen.queryByText("Wallet required")).toBeNull();
  });
});

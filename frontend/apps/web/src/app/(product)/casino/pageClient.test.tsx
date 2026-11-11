import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../i18n/locales/en/common.json";
import zh from "../../../i18n/locales/zh-Hans/common.json";

const USDC = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";

const state = {
  release: null as any,
  chainId: 84532,
  disabled: undefined as ReadonlySet<string> | undefined,
  stats: undefined as any
};

vi.mock("../../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ release: state.release, chainId: state.chainId })
}));

vi.mock("../../../features/casino/useDisabledGames", async (importActual) => ({
  ...(await importActual<typeof import("../../../features/casino/useDisabledGames")>()),
  useDisabledGameIds: () => state.disabled
}));

vi.mock("../../../features/casino/useCasinoStats", () => ({
  useCasinoStats: () => ({ data: state.stats })
}));

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

import { CasinoLobbyClient } from "./pageClient";

function release(chainId = 84532) {
  return {
    chainId,
    releaseDigest: "0xdigest",
    defaultHouseEdgeBps: 200,
    contracts: {},
    assets: [{ address: USDC, symbol: "USDC", decimals: 6 }],
    pools: [{ asset: USDC, bank: "0x00000000000000000000000000000000000000dd", decimals: 6 }],
    gamesMeta: [
      { gameId: "0x01", slug: "coin-toss", label: "Coin Toss", module: "0x01", maxBetCount: 25 },
      { gameId: "0x02", slug: "dice", label: "Dice", module: "0x02", maxBetCount: 25 },
      { gameId: "0x03", slug: "keno", label: "Keno", module: "0x03", maxBetCount: 10 }
    ]
  };
}

function renderLobby(locale: "en" | "zh-Hans" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : zh}>
      <CasinoLobbyClient />
    </NextIntlClientProvider>
  );
}

const stubs = () => screen.getAllByRole("listitem").map((item) => item.dataset.slug);

beforeEach(() => {
  state.release = release();
  state.chainId = 84532;
  vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "false");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  Object.assign(state, { disabled: undefined, stats: undefined });
});

describe("casino lobby", () => {
  it("sets one felt table per game, simplest first, with its win chance and top pay after the house edge", () => {
    renderLobby();

    expect(screen.getByRole("heading", { level: 1, name: "Pick a game." })).toBeVisible();
    expect(stubs()).toEqual(["coin-toss", "dice", "keno"]);
    const coin = screen.getByRole("link", { name: /^Coin Toss\./ });
    expect(coin).toHaveAttribute("href", "/casino/coin-toss");
    expect(coin).toHaveAccessibleName(
      "Coin Toss. Call heads or tails. Win chance 50%. Pays 1.96 times the stake."
    );
    expect(coin).toHaveTextContent("Win chance50%Pays1.96×");
    const dice = screen.getByRole("link", { name: /^Dice\./ });
    expect(dice).toHaveAccessibleName(
      "Dice. Set a line and roll under or over it. Win chance 2% to 97%. Pays up to 49.00 times the stake."
    );
    expect(dice).toHaveTextContent("Win chance2%–97%Up to49.00×");
    expect(screen.getByRole("link", { name: /^Keno\./ })).toHaveTextContent(
      "Win chance9.5%–33.3%Up to490.49×"
    );
    expect(screen.getByText(/with the 2% house edge already counted/)).toBeVisible();
    expect(screen.getByText(/up to 25 rounds/)).toBeVisible();
  });

  it("leaves out a game GameHub has disabled", () => {
    state.disabled = new Set(["0x02"]);
    renderLobby();

    expect(stubs()).toEqual(["coin-toss", "keno"]);
  });

  it("says so when every game is disabled", () => {
    state.disabled = new Set(["0x01", "0x02", "0x03"]);
    renderLobby();

    expect(screen.getByRole("status")).toHaveTextContent("No game is taking bets right now.");
  });

  it("offers only the Telegram channel while betting is closed", () => {
    renderLobby();

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: /Join the channel/ })).toHaveAttribute(
      "href",
      "https://t.me/arbigamefi"
    );
    expect(within(header).getByText(/Until then you can read each game's rules/)).toBeVisible();
    expect(screen.queryByRole("link", { name: /play/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "Get test USDC" })).toBeNull();
  });

  it("marks a test chain and links the test USDC faucet once betting opens there", () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
    renderLobby();

    expect(screen.getByText(/Bets on Base Sepolia use test USDC/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Get test USDC" })).toHaveAttribute(
      "href",
      "https://faucet.circle.com"
    );
    expect(screen.queryByRole("link", { name: /Join the channel/ })).toBeNull();
  });

  it("prints no site state on a live chain", () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
    state.chainId = 8453;
    state.release = release(8453);
    renderLobby();

    expect(screen.queryByText(/test USDC/)).toBeNull();
    expect(screen.queryByRole("link", { name: /Join the channel/ })).toBeNull();
    expect(stubs()).toHaveLength(3);
  });

  it("explains a chain without a release and prints no stubs", () => {
    state.release = null;
    renderLobby();

    expect(screen.getByText("Games aren't available on this network yet.")).toBeVisible();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByRole("link", { name: /Join the channel/ })).toBeNull();
  });

  it("prints what the bet index has counted, and nothing before the first bet", () => {
    state.stats = {
      source: "postgres",
      asset: { symbol: "USDC", decimals: 6 },
      stats: { betCount: 1234, uniquePlayers: 56, turnover: "7890120000" }
    };
    const { unmount } = renderLobby();

    const stats = screen.getByLabelText("Bets so far");
    expect(stats).toHaveTextContent("Bets placed1,234");
    expect(stats).toHaveTextContent("Players56");
    expect(stats).toHaveTextContent("Total staked7,890.12USDC");
    unmount();

    state.stats = { ...state.stats, stats: { betCount: 0, uniquePlayers: 0, turnover: "0" } };
    renderLobby();
    expect(screen.queryByLabelText("Bets so far")).toBeNull();
  });

  it("writes the lobby for Chinese readers", () => {
    renderLobby("zh-Hans");

    expect(screen.getByRole("heading", { level: 1, name: "选一个游戏。" })).toBeVisible();
    expect(screen.getByRole("link", { name: /^骰子。/ })).toHaveAccessibleName(
      "骰子。设一条线，押掷出低于或高于它。中奖概率 2% 至 97%。最高赔下注额的 49.00 倍。"
    );
    expect(screen.getByRole("link", { name: /^抛硬币。/ })).toHaveTextContent("中奖概率50%赔1.96×");
  });
});

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../i18n/locales/en/common.json";
import zh from "../../i18n/locales/zh-Hans/common.json";

const TIMELOCK = "0x00000000000000000000000000000000000000aa";
const VRF_HUB = "0x00000000000000000000000000000000000000bb";
const DICE = "0x00000000000000000000000000000000000000cc";
const USDC = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";

const state = {
  release: null as any,
  chainId: 84532,
  bets: [] as any[],
  betsPending: false,
  betsError: false,
  disabled: undefined as ReadonlySet<string> | undefined,
  overview: undefined as any,
  overviewPending: false,
  overviewError: false
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: state.overview,
    isPending: state.overviewPending,
    isError: state.overviewError
  })
}));

vi.mock("../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ release: state.release, chainId: state.chainId })
}));

vi.mock("../../features/betting/useRecentBets", () => ({
  useRecentBets: () => ({
    data: state.bets,
    isPending: state.betsPending,
    isError: state.betsError
  })
}));

vi.mock("../../features/casino/useDisabledGames", async (importActual) => ({
  ...(await importActual<typeof import("../../features/casino/useDisabledGames")>()),
  useDisabledGameIds: () => state.disabled
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

import { HomePageClient } from "./pageClient";

function release(chainId = 84532) {
  return {
    chainId,
    name: "Base Sepolia",
    releaseDigest: "0xdigest",
    refundTimeoutSeconds: 3600,
    defaultHouseEdgeBps: 200,
    contracts: {
      governanceTimelock: TIMELOCK,
      vrfHub: VRF_HUB,
      gameHub: "0x00000000000000000000000000000000000000dd"
    },
    assets: [{ address: USDC, symbol: "USDC", decimals: 6 }],
    gamesMeta: [
      { gameId: "0x01", slug: "coin-toss", label: "Coin Toss", module: "0x01", maxBetCount: 25 },
      { gameId: "0x02", slug: "dice", label: "Dice", module: DICE, maxBetCount: 25 },
      { gameId: "0x03", slug: "keno", label: "Keno", module: "0x03", maxBetCount: 10 }
    ]
  };
}

function bet(betId: string, overrides: Record<string, unknown> = {}) {
  return {
    betId,
    gameId: "0x01",
    asset: USDC,
    state: "finalized",
    stake: "10000",
    payoutGross: "20000",
    payout: "19600",
    refundAmount: "0",
    placedBlock: 51_346_846,
    requestId: "86577843407123870663933366161905983352653535481161166303575843784462175295639",
    randomHash: "0x1f63000000000000000000000000000000000000000000000000000000001013",
    terminalTxHash: "0x7e24000000000000000000000000000000000000000000000000000000af90",
    ...overrides
  };
}

function renderHome(locale: "en" | "zh-Hans" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : zh}>
      <HomePageClient />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  state.release = release();
  state.chainId = 84532;
  vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "false");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  Object.assign(state, {
    bets: [],
    betsPending: false,
    betsError: false,
    disabled: undefined,
    overview: undefined,
    overviewPending: false,
    overviewError: false
  });
});

describe("home page", () => {
  it("prints the latest settled bet, wins and losses alike, and skips unsettled ones", () => {
    state.bets = [
      bet("7", { state: "randomReady", payoutGross: undefined, payout: undefined }),
      bet("1"),
      bet("3", { gameId: "0x02", stake: "1500000", payoutGross: "0", payout: "0" })
    ];
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: "Every bet prints a receipt." })
    ).toBeVisible();
    const win = screen.getByRole("article", { name: "Receipt for bet 1" });
    expect(within(win).getByText("Coin Toss")).toBeVisible();
    expect(within(win).getByText("Base Sepolia, block 51,346,846")).toBeVisible();
    expect(within(win).getByText("Paid to wallet", { selector: "div" })).toBeInTheDocument();
    expect(within(win).getByText("House edge, 2%")).toBeVisible();
    expect(within(win).getByText("0.0196")).toBeVisible();
    expect(win.querySelector(".text-total")?.textContent).toBe("+0.0096USDC");
    expect(within(win).getByRole("link", { name: "Open this receipt" })).toHaveAttribute(
      "href",
      "/casino/receipt/84532/1"
    );
    expect(screen.queryByRole("article", { name: "Receipt for bet 7" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Print another receipt" }));
    const loss = screen.getByRole("article", { name: "Receipt for bet 3" });
    expect(within(loss).getByText("Dice")).toBeVisible();
    expect(within(loss).getByText("Settled")).toBeInTheDocument();
    expect(screen.getByText("Bet 3, Dice. Net result −1.50 USDC.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The latest settled bets on the testnet, wins and losses alike. Testnet funds have no value."
      )
    ).toBeVisible();
  });

  it("says when no bet has settled instead of printing a made-up receipt", () => {
    renderHome();
    expect(screen.getByRole("status")).toHaveTextContent("No bet has settled yet.");
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("button", { name: "Print another receipt" })).toBeNull();
  });

  it("before launch, points to the official channels and nowhere to play", () => {
    renderHome();
    expect(
      screen.getByText("Betting opens on Base after the audit report is published.")
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Join the channel/ })).toHaveAttribute(
      "href",
      "https://t.me/arbigamefi"
    );
    expect(screen.getByRole("link", { name: "@arbi_game_fi" })).toHaveAttribute(
      "href",
      "https://x.com/arbi_game_fi"
    );
    expect(screen.queryByText("Play on testnet")).toBeNull();
    expect(screen.queryByText("Play now")).toBeNull();
  });

  it("on an open test chain, says the funds are test funds and where to get them", () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
    renderHome();
    expect(
      screen.getByText(/Bets on Base Sepolia use test USDC, which has no value/)
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Play on testnet" })).toHaveAttribute(
      "href",
      "/casino"
    );
    expect(screen.getByRole("link", { name: "Get test USDC" })).toHaveAttribute(
      "href",
      "https://faucet.circle.com"
    );
    expect(screen.queryByRole("link", { name: /Join the channel/ })).toBeNull();
  });

  it("on an open main chain, shows the launch action", () => {
    vi.stubEnv("NEXT_PUBLIC_CASINO_RISK_IN_ENABLED", "true");
    state.chainId = 8453;
    state.release = release(8453);
    state.bets = [bet("1")];
    renderHome();
    expect(screen.getByRole("link", { name: "Play now" })).toHaveAttribute("href", "/casino");
    expect(screen.queryByText(/test USDC/)).toBeNull();
    expect(screen.getByText("The latest settled bets, wins and losses alike.")).toBeVisible();
  });

  it("links every check to its public record", () => {
    renderHome();
    const ledger = screen.getByRole("region", { name: "Check it before you bet" });
    expect(
      within(ledger).getByRole("link", { name: "See the randomness contract" })
    ).toHaveAttribute("href", `https://sepolia.basescan.org/address/${VRF_HUB}`);
    expect(within(ledger).getByRole("link", { name: "Read a game contract" })).toHaveAttribute(
      "href",
      `https://sepolia.basescan.org/address/${DICE}`
    );
    expect(within(ledger).getByRole("link", { name: "See the timelock" })).toHaveAttribute(
      "href",
      `https://sepolia.basescan.org/address/${TIMELOCK}`
    );
    expect(
      within(ledger).getByText(
        "Every game keeps 2% of a win. It is already counted in the multipliers below."
      )
    ).toBeVisible();
    expect(within(ledger).getByText("Not yet published")).toBeVisible();
  });

  it("prints a ticket stub for each enabled game with its top multiplier", () => {
    state.disabled = new Set(["0x03"]);
    renderHome();
    const games = screen.getByRole("region", { name: "Games and what they pay" });
    const coin = within(games).getByRole("link", { name: /Coin Toss/ });
    expect(coin).toHaveAttribute("href", "/casino/coin-toss");
    expect(coin).toHaveTextContent("pays1.96×");
    expect(within(games).getByRole("link", { name: /Dice/ })).toHaveTextContent("up to49×");
    expect(within(games).queryByRole("link", { name: /Keno/ })).toBeNull();
    expect(within(games).getByText(/One transaction can play up to 25 rounds/)).toBeVisible();
    expect(screen.getByText(/you can take your stake back after an hour/)).toBeVisible();
  });

  it("shows the house pool figures it read, and a dash for what it could not", () => {
    const rows = [
      {
        address: USDC,
        symbol: "USDC",
        decimals: 6,
        lpCapital: 1_000_000n,
        lockedCapital: 250_000n,
        turnover: 12_500_000n,
        protocolFee: 0n
      },
      {
        address: USDC,
        symbol: "USDC",
        decimals: 6,
        lpCapital: 500_000n,
        lockedCapital: 0n,
        turnover: 0n,
        protocolFee: 0n
      }
    ];
    state.overview = { assets: rows };
    const { rerender } = renderHome();
    const figures = screen.getByLabelText("House pool in USDC");
    expect(figures).toHaveTextContent("In the house pool1.50USDC");
    expect(figures).toHaveTextContent("Free to pay winners1.25USDC");
    expect(figures).toHaveTextContent("Staked since launch12.50USDC");

    // A failed refresh keeps the old data in the cache; it is no longer current.
    state.overviewError = true;
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <HomePageClient />
      </NextIntlClientProvider>
    );
    expect(screen.getByLabelText("House pool in USDC")).toHaveTextContent(
      "In the house pool—Free to pay winners—Staked since launch—"
    );
  });

  it("speaks Chinese with the Chinese terms", () => {
    state.bets = [bet("1")];
    renderHome("zh-Hans");
    expect(screen.getByRole("heading", { level: 1, name: "每一注都打印一张凭证。" })).toBeVisible();
    expect(screen.getByRole("article", { name: "第 1 注的凭证" })).toHaveTextContent("庄家优势 2%");
    expect(screen.getByText(/1 小时后你可以取回下注额/)).toBeVisible();
  });
});

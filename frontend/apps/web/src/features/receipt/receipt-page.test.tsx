import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import en from "../../i18n/locales/en/common.json";
import type { ReceiptPageView } from "./receipt-page-model";
import { ReceiptPage } from "./receipt-page";

const HUB = "0x0000000000000000000000000000000000000064";
const PLAYER = "0x00000000000000000000000000000000000000cc";
const TX = "0x00000000000000000000000000000000000000000000000000000000000000aa";

const sdk = vi.hoisted(() => ({
  release: { chainId: 84532, contracts: { gameHub: "0x0000000000000000000000000000000000000064" } },
  account: undefined as string | undefined,
  gameHub: { getBet: vi.fn() },
  bank: { getPlayerPayable: vi.fn() }
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../../ssot/sdk", () => ({ useSSOTSDK: () => ({ sdk, ready: true }) }));
vi.mock("../../ssot/release/ReleaseProvider", () => ({ useRelease: () => ({ readOnly: false }) }));
vi.mock("../../app-shell/wallet-connect-events", () => ({ requestWalletConnect: vi.fn() }));
vi.mock("../casino/room/outcome", () => ({
  readCasinoOutcome: async () => ({
    kind: "dice",
    direction: "under",
    target: 49,
    rolls: [{ value: 66, won: false }]
  })
}));

const bet = {
  chainId: 84532,
  betId: "5",
  gameHub: HUB,
  gameSlug: "dice",
  gameLabel: "Dice",
  symbol: "USDC",
  decimals: 6
};

function show(view: ReceiptPageView) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <ReceiptPage view={view} />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

const printed = (overrides: Partial<Extract<ReceiptPageView, { kind: "printed" }>> = {}) =>
  ({
    kind: "printed",
    bet,
    receipt: {
      betId: "5",
      href: `/casino/receipt/84532/5?hub=${HUB}`,
      stamp: "settled",
      owed: false,
      net: { sign: "−", whole: "0", fraction: "80" },
      lines: [
        { key: "stake", amount: "0.80" },
        { key: "won", amount: "0.00" },
        { key: "houseEdge", amount: "0.00" },
        { key: "paid", amount: "0.00" }
      ],
      requestId: "1782",
      randomHash: "0xf106000000000000000000000000000000000000000000000000000000e846",
      settledTx: TX,
      settledTxHref: `https://sepolia.basescan.org/tx/${TX}`
    },
    houseEdgeBps: 200,
    poolId: 1,
    player: PLAYER,
    asset: "0x0000000000000000000000000000000000000001",
    placedBlock: 456,
    lastEventName: "BetFinalized",
    indexedAt: 1_717_171_717_000,
    source: "index",
    ...overrides
  }) as ReceiptPageView;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReceiptPage", () => {
  it("prints the receipt, the game's draw and the randomness fee apart from the amounts", async () => {
    sdk.gameHub.getBet.mockResolvedValue({ vrfFeeCharged: 12_345_678_901_234n });
    show(printed());
    const receipt = screen.getByRole("article", { name: "Receipt for bet 5" });
    expect(within(receipt).getByText("Settled")).toBeTruthy();
    expect(within(receipt).getByText("House edge, 2%")).toBeTruthy();
    expect(await within(receipt).findByText("Rolled 66.")).toBeTruthy();
    expect(within(receipt).getByText("1–49 wins.")).toBeTruthy();
    expect(within(receipt).getByText("0.000012345678901234 ETH")).toBeTruthy();
    expect(within(receipt).getByRole("link", { name: "0x0000…00aa" }).getAttribute("href")).toBe(
      `https://sepolia.basescan.org/tx/${TX}`
    );
    expect(screen.getByRole("heading", { level: 1, name: "Receipt for bet 5" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Play Dice" }).getAttribute("href")).toBe(
      "/casino/dice?chainId=84532"
    );
    expect(screen.getByRole("heading", { name: "Where these facts come from" })).toBeTruthy();
  });

  it("prints a dash for the fee of a bet another release issued", () => {
    show(printed({ bet: { ...bet, gameHub: "0x00000000000000000000000000000000000000ff" } }));
    expect(sdk.gameHub.getBet).not.toHaveBeenCalled();
    const fee = screen.getByText("Randomness fee").nextElementSibling;
    expect(fee?.textContent).toBe("—");
  });

  it("offers the claim on a voided receipt", async () => {
    sdk.gameHub.getBet.mockResolvedValue({ vrfFeeCharged: 1n });
    sdk.bank.getPlayerPayable.mockResolvedValue(800_000n);
    show(
      printed({
        receipt: {
          ...(printed() as Extract<ReceiptPageView, { kind: "printed" }>).receipt,
          stamp: "voided",
          net: { sign: "", whole: "0", fraction: "00" },
          lines: [
            { key: "stake", amount: "0.80" },
            { key: "claimable", amount: "0.80" }
          ]
        }
      })
    );
    expect(screen.getByText("Voided")).toBeTruthy();
    expect(screen.getByText("Claimable balance")).toBeTruthy();
    expect(screen.getByText(/the stake became a claimable balance/)).toBeTruthy();
    expect(await screen.findByText("Waiting to be claimed: 0.80 USDC")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect a wallet to claim" })).toBeTruthy();
  });

  it("prints a held payout as owed, with its payment", async () => {
    sdk.gameHub.getBet.mockResolvedValue({ vrfFeeCharged: 1n });
    sdk.bank.getPlayerPayable.mockResolvedValue(0n);
    const base = (printed() as Extract<ReceiptPageView, { kind: "printed" }>).receipt;
    show(
      printed({
        payment: "payable",
        receipt: {
          ...base,
          owed: true,
          lines: [...base.lines.slice(0, 3), { key: "owed", amount: "0.00" }]
        }
      })
    );
    expect(screen.getByText("Owed to you")).toBeTruthy();
    expect(screen.getByText("Held for the wallet")).toBeTruthy();
    expect(screen.getByText(/The payout is held for you/)).toBeTruthy();
  });

  it("prints a bet still waiting as paper being printed, with no stamp", () => {
    show({
      kind: "pending",
      bet,
      state: "placed",
      stake: "0.80",
      requestId: "1782",
      placedBlock: 456
    });
    expect(screen.getByRole("heading", { level: 1, name: "Bet 5 is printing" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Waiting for randomness");
    expect(screen.queryByText("Settled")).toBeNull();
    expect(screen.getByRole("link", { name: "Open in your activity" })).toBeTruthy();
  });

  it("says a missing bet and an unreadable index apart", () => {
    show({ kind: "missing", bet });
    expect(screen.getByRole("heading", { level: 1, name: "No receipt for bet 5" })).toBeTruthy();
    cleanup();
    show({ kind: "degraded", bet });
    expect(
      screen.getByRole("heading", { level: 1, name: "Receipts cannot be read right now" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

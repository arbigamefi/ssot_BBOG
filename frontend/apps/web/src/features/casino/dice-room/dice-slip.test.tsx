import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import type { CasinoAccess } from "../../../app-shell/casino-access";
import en from "../../../i18n/locales/en/common.json";
import type { GameRoom } from "../room/use-game-room";
import { DiceSlip } from "./dice-slip";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

const requestWalletConnect = vi.hoisted(() => vi.fn());
vi.mock("../../../app-shell/wallet-connect-events", () => ({ requestWalletConnect }));

type RoomOverrides = Omit<Partial<GameRoom>, "casinoRound"> & {
  casinoRound?: Record<string, unknown>;
};

function makeRoom(overrides: RoomOverrides = {}) {
  const { casinoRound, ...rest } = overrides;
  return {
    chainId: 84532,
    sdk: { account: "0x5Ea1000000000000000000000000000000007C04" },
    wrongNetwork: false,
    switchNetwork: vi.fn(),
    assetDecimals: 6,
    assetSymbol: "USDC",
    betAmount: "1.00",
    setBetAmount: vi.fn(),
    betCount: 1,
    setBetCount: vi.fn(),
    diceDirection: "under",
    diceTarget: 50,
    houseEdgeBps: 200,
    poolSnapshot: { minBetAmount: 10_000n },
    limits: { maxBetRaw: 4_050_000n },
    walletBalance: { raw: 12_400_000n },
    refreshPool: vi.fn(),
    isBetPanelPending: false,
    placeBetButtonPhase: "ready",
    showResult: false,
    resultProof: null,
    casinoOutcome: null,
    handleResultPlayAgain: vi.fn(),
    handleResultClose: vi.fn(),
    ...rest,
    casinoRound: {
      state: { status: "idle" },
      maxBetCount: 25,
      vrfQuote: 37_220_000_000_000n,
      availability: "ready",
      checkTransaction: undefined,
      checkingTransaction: false,
      placeBet: vi.fn(),
      activeBet: undefined,
      activeBetId: undefined,
      manualSettleAvailable: false,
      manualSettle: vi.fn(),
      manualRefundAvailable: false,
      manualRefund: vi.fn(),
      ...casinoRound
    }
  } as unknown as GameRoom;
}

function renderSlip(room: GameRoom, access: CasinoAccess = "testnet") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DiceSlip
        room={room}
        access={access}
        chainName="Base Sepolia"
        houseEdgeRate="2%"
        holdReceipt={false}
        className=""
      />
    </NextIntlClientProvider>
  );
}

const slip = () => within(screen.getByRole("article"));

describe("DiceSlip", () => {
  afterEach(() => {
    cleanup();
    requestWalletConnect.mockClear();
  });

  it("quotes the bet and places it with the main button", () => {
    const room = makeRoom();
    renderSlip(room);
    expect(slip().getAllByText("Dice, win on 1–50")).toHaveLength(2);
    expect(slip().getAllByText("1.96 USDC").length).toBeGreaterThan(0);
    expect(slip().getByText("up to 0.00005583 ETH")).toBeDefined();
    expect(slip().getByText("Balance 12.40 USDC.")).toBeDefined();
    const place = slip().getByRole("button", { name: /Place bet/ });
    expect(place.textContent).toBe("Place bet1.00 USDC + fee");
    fireEvent.click(place);
    expect(room.casinoRound.placeBet).toHaveBeenCalledTimes(1);
  });

  it("quotes each win and the total stake for several rounds", () => {
    renderSlip(makeRoom({ betCount: 5 }));
    expect(slip().getByText("Total stake")).toBeDefined();
    expect(slip().getByText("5.00 USDC")).toBeDefined();
    expect(slip().getByLabelText("Stake per round")).toBeDefined();
    expect(slip().getByRole("button", { name: /Place bet/ }).textContent).toContain(
      "5.00 USDC + fee"
    );
  });

  it("asks a preview visitor to join Telegram and locks the slip", () => {
    renderSlip(makeRoom({ sdk: undefined }), "preview");
    expect(slip().getByText("Betting isn't open yet.")).toBeDefined();
    expect(slip().getByRole("link", { name: "Join on Telegram" }).getAttribute("href")).toBe(
      "https://t.me/arbigamefi"
    );
    expect(slip().getByLabelText("Stake").hasAttribute("disabled")).toBe(true);
    expect(slip().queryByText(/Connect a wallet/)).toBeNull();
  });

  it("connects a wallet first", () => {
    renderSlip(makeRoom({ sdk: undefined, walletBalance: null }));
    fireEvent.click(slip().getByRole("button", { name: "Connect wallet" }));
    expect(requestWalletConnect).toHaveBeenCalledTimes(1);
    expect(slip().getByText("Connect a wallet to see your balance here.")).toBeDefined();
  });

  it("switches a wallet on another network", () => {
    const room = makeRoom({ wrongNetwork: true });
    renderSlip(room);
    expect(slip().getByText("Your wallet is on another network.")).toBeDefined();
    fireEvent.click(slip().getByRole("button", { name: "Switch to Base Sepolia" }));
    expect(room.switchNetwork).toHaveBeenCalledTimes(1);
  });

  it("turns the main button into the fix when the stake is over the pool's limit", () => {
    const room = makeRoom({ betAmount: "5", limits: { maxBetRaw: 1_069_999n } as never });
    renderSlip(room);
    expect(slip().getByText("Too high for the house pool.")).toBeDefined();
    expect(slip().getByText("At a 50% chance the most you can stake is 1.06 USDC.")).toBeDefined();
    fireEvent.click(slip().getByRole("button", { name: /Lower to 1\.06/ }));
    expect(room.setBetAmount).toHaveBeenCalledWith("1.06");
  });

  it("raises a stake under a minimum off the quote's grid to one the pool accepts", () => {
    const room = makeRoom({ betAmount: "0.1", poolSnapshot: { minBetAmount: 123_456n } as never });
    renderSlip(room);
    expect(slip().getByText("Bets start at 0.1235 USDC a round.")).toBeDefined();
    fireEvent.click(slip().getByRole("button", { name: /Raise to 0\.1235/ }));
    expect(room.setBetAmount).toHaveBeenCalledWith("0.1235");
  });

  it("sets the stake from the chips, Max being the pool's limit or the balance", () => {
    const room = makeRoom();
    renderSlip(room);
    fireEvent.click(slip().getByRole("button", { name: "Max 4.05" }));
    expect(room.setBetAmount).toHaveBeenLastCalledWith("4.05");
    fireEvent.click(slip().getByRole("button", { name: "Half" }));
    expect(room.setBetAmount).toHaveBeenLastCalledWith("0.50");
    fireEvent.click(slip().getByRole("button", { name: "Double" }));
    expect(room.setBetAmount).toHaveBeenLastCalledWith("2.00");
  });

  it("names each wallet step while signing and says it out loud", () => {
    renderSlip(
      makeRoom({
        casinoRound: {
          state: {
            status: "submitting",
            executionStage: "approve",
            plan: { preview: { needsApproval: true } }
          }
        }
      })
    );
    const step = slip().getByRole("button", { name: /Approve USDC in wallet/ });
    expect(step.hasAttribute("disabled")).toBe(true);
    expect(step.textContent).toContain("Step 1 of 2");
    expect(slip().getByLabelText("Stake").hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Confirm in your wallet.")).toBeDefined();
  });

  it("says why the last attempt failed", () => {
    renderSlip(
      makeRoom({ casinoRound: { state: { status: "failed", error: { code: "USER_REJECTED" } } } })
    );
    expect(slip().getByText("You cancelled in your wallet.")).toBeDefined();
    expect(slip().getByRole("button", { name: /Place bet/ })).toBeDefined();
  });

  it("prints the wait for randomness once the bet is placed", () => {
    renderSlip(
      makeRoom({
        isBetPanelPending: true,
        placeBetButtonPhase: "waiting_vrf",
        casinoRound: {
          activeBet: {
            betId: 7n,
            stake: 1_000_000n,
            amountPerRoll: 1_000_000n,
            betCount: 1,
            houseEdgeBps: 200,
            placedAt: Math.floor(Date.now() / 1000)
          }
        }
      })
    );
    expect(slip().getByText("Bet 7")).toBeDefined();
    // The phone sheet's summary line says it too.
    expect(slip().getAllByText("Waiting for randomness")).toHaveLength(2);
    expect(screen.getByText("Bet placed. Waiting for randomness.")).toBeDefined();
  });

  it("offers the refund once the wait is over", () => {
    const room = makeRoom({
      isBetPanelPending: true,
      placeBetButtonPhase: "refundable",
      casinoRound: {
        manualRefundAvailable: true,
        activeBet: { betId: 7n, stake: 1_000_000n, amountPerRoll: 1_000_000n, betCount: 1 }
      }
    });
    renderSlip(room);
    expect(slip().getAllByText("No random number arrived")).toHaveLength(2);
    fireEvent.click(slip().getByRole("button", { name: "Refund 1.00 USDC" }));
    expect(room.casinoRound.manualRefund).toHaveBeenCalledTimes(1);
  });
});

describe("DiceReceipt", () => {
  afterEach(cleanup);

  const settled = makeRoom({
    showResult: true,
    diceDirection: "over",
    diceTarget: 5,
    resultProof: {
      kind: "settled",
      betId: 5n,
      requestId: 1782_0000_2627n,
      randomHash: "0xf1060000000000000000000000000000000000000000000000000000000e846",
      player: "0x5Ea1000000000000000000000000000000007C04",
      stake: 800_000n,
      settlement: {
        txHash: "0x897a0000000000000000000000000000000000000000000000000000000029cd",
        payoutGross: 842_105n,
        feeOnPayout: 16_842n,
        payoutNet: 825_263n,
        refundAmount: 0n
      }
    } as never,
    casinoOutcome: {
      kind: "dice",
      direction: "over",
      target: 5,
      rolls: [{ value: 67, won: true }],
      payoutGross: 842_105n
    } as never
  });

  it("prints the settled bet exactly, with its proof and public page", () => {
    renderSlip(settled);
    const receipt = within(screen.getByRole("article", { name: "Receipt for bet 5" }));
    expect(receipt.getByText("Dice, win on 6–100")).toBeDefined();
    expect(receipt.getAllByText("Rolled 67.")).toHaveLength(2);
    expect(receipt.getAllByText("Paid to wallet")).toHaveLength(2);
    expect(receipt.getByText("House edge, 2%")).toBeDefined();
    expect(receipt.getByText("0.825263")).toBeDefined();
    expect(receipt.getByRole("link", { name: "Open this receipt" }).getAttribute("href")).toBe(
      "/casino/receipt/84532/5"
    );
    expect(screen.getByText("Rolled 67. Net result +0.025263 USDC.")).toBeDefined();
  });

  it("waits for the ball to stop before it prints", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <DiceSlip
          room={{ ...settled, isBetPanelPending: true } as GameRoom}
          access="testnet"
          chainName="Base Sepolia"
          houseEdgeRate="2%"
          holdReceipt
          className=""
        />
      </NextIntlClientProvider>
    );
    expect(screen.queryByRole("article", { name: "Receipt for bet 5" })).toBeNull();
  });

  it("tears the receipt off for the next bet or a change", () => {
    renderSlip(settled);
    fireEvent.click(screen.getByRole("button", { name: "Bet again" }));
    expect(settled.handleResultPlayAgain).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Change bet" }));
    expect(settled.handleResultClose).toHaveBeenCalledTimes(1);
  });
});

describe("the phone sheet", () => {
  afterEach(cleanup);

  it("opens the full slip from its summary line", () => {
    renderSlip(makeRoom());
    const head = screen.getByRole("button", { name: "Dice, win on 1–50. Show the full slip" });
    expect(head.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(head);
    expect(
      screen
        .getByRole("button", { name: "Dice, win on 1–50. Show less" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });
});

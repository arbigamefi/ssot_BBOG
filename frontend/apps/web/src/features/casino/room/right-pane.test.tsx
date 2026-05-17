import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameRoomRightPane } from "./right-pane";

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "casino.room.selection.dice.rollUnder": "Roll Under",
      "casino.room.selection.dice.rollOver": "Roll Over",
      "casino.room.selection.dice.targetRange": "Target Range",
      "casino.room.selection.dice.targetAria": "Dice target",
      "casino.room.selection.dice.target": "Target",
      "casino.room.selection.dice.multiplier": "Mult",
      "casino.room.selection.dice.winChance": "Win",
      "casino.room.stage.loading": "Loading stage",
      "casino.room.history.recent.rolls": "RECENT ROLLS",
      "casino.room.history.recent.numbers": "RECENT NUMBERS",
      "casino.room.history.recent.draws": "RECENT DRAWS",
      "casino.room.history.recent.flips": "RECENT FLIPS",
      "casino.room.history.states.settled": "SETTLED",
      "casino.room.history.states.refunded": "REFUNDED",
      "casino.room.history.states.vrfReady": "VRF READY",
      "casino.room.history.states.placed": "PLACED",
      "casino.room.history.empty": "Waiting for first play...",
      "casino.room.result.title": "Chain result",
      "casino.room.result.outcomes.refunded.label": "Stake refunded",
      "casino.room.result.outcomes.refunded.detail":
        "The refund path returned the stake after the VRF timeout window.",
      "casino.room.result.outcomes.win.label": "Win confirmed",
      "casino.room.result.outcomes.win.detail": "Payout proof is confirmed from BetFinalized.",
      "casino.room.result.outcomes.returned.label": "Stake returned",
      "casino.room.result.outcomes.returned.detail": "The settled payout equals the stake.",
      "casino.room.result.outcomes.loss.label": "Loss confirmed",
      "casino.room.result.outcomes.loss.detail":
        "BetFinalized is confirmed with zero or below-stake payout.",
      "casino.room.result.facts.betId": "Bet ID",
      "casino.room.result.facts.netPayout": "Net payout",
      "casino.room.result.facts.refund": "Refund",
      "casino.room.result.facts.requestId": "Request ID",
      "casino.room.result.facts.netResult": "Net result",
      "casino.room.result.facts.randomHash": "Random hash",
      "casino.room.result.facts.settlementTx": "Settlement tx"
    })[key] ?? key
}));

const baseProps = {
  coinSide: "HEADS" as const,
  flipCount: 0,
  gameHistory: [],
  recentBets: [],
  isPending: false,
  showResult: false,
  resultNum: null,
  diceDirection: "under" as const,
  diceTarget: 50,
  multiplier: 1.98,
  winChance: 50,
  rouletteSpots: [],
  kenoSpots: [],
  animatingKenoSpots: [],
  kenoResultDrawn: [],
  resultProof: null,
  chainId: 84532,
  assetSymbol: "USDC",
  assetDecimals: 6,
  onDiceDirectionChange: vi.fn(),
  onDiceTargetChange: vi.fn(),
  onRouletteChange: vi.fn(),
  onKenoChange: vi.fn(),
  onKenoResetResult: vi.fn()
};

describe("GameRoomRightPane", () => {
  afterEach(() => cleanup());

  it("renders the empty live tracker and dice stage", async () => {
    render(<GameRoomRightPane {...baseProps} gameSlug="dice" />);

    expect(screen.getByText("RECENT ROLLS")).toBeDefined();
    expect(screen.getByText("Waiting for first play...")).toBeDefined();
    expect(await screen.findByText("Roll Under")).toBeDefined();
  });

  it("renders chain bet status and result overlay", () => {
    render(
      <GameRoomRightPane
        {...baseProps}
        gameSlug="roulette"
        showResult
        resultNum={17}
        resultProof={{
          kind: "settled",
          betId: 123456n,
          requestId: 88n,
          randomHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          stake: 10_000_000n,
          settlement: {
            txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            payoutGross: 20_000_000n,
            payoutNet: 19_600_000n,
            feeOnPayout: 400_000n,
            protocolFeeAccrual: 200_000n
          }
        }}
        gameHistory={[{ val: 17, win: true }]}
        recentBets={[{ id: "84532:123456", betId: "123456", state: "finalized" }]}
      />
    );

    expect(screen.getByText("RECENT NUMBERS")).toBeDefined();
    expect(screen.getByText("SETTLED")).toBeDefined();
    expect(screen.getByText("Win confirmed")).toBeDefined();
    expect(screen.getByText("19.6 USDC")).toBeDefined();
  });

  it("does not open the result overlay until terminal proof is available", () => {
    render(
      <GameRoomRightPane
        {...baseProps}
        gameSlug="roulette"
        showResult
        resultProof={{
          kind: "indexing",
          betId: 13n,
          requestId: 88n,
          randomHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          stake: 10_000_000n
        }}
      />
    );

    expect(screen.queryByText("Chain result")).toBeNull();
    expect(screen.queryByText("Reading result")).toBeNull();
    expect(screen.queryByText("Win confirmed")).toBeNull();
  });
});

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
      "casino.room.result.title": "Bet details",
      "casino.room.result.outcomes.refunded.label": "Stake refunded",
      "casino.room.result.outcomes.refunded.detail":
        "The refund path returned the stake after the VRF timeout window.",
      "casino.room.result.outcomes.win.label": "Won bet",
      "casino.room.result.outcomes.win.detail":
        "The round settled on-chain and payout is confirmed.",
      "casino.room.result.outcomes.returned.label": "Stake returned",
      "casino.room.result.outcomes.returned.detail": "The settled payout equals the stake.",
      "casino.room.result.outcomes.loss.label": "Lost bet",
      "casino.room.result.outcomes.loss.detail": "The round settled on-chain with no net payout.",
      "casino.room.result.sections.gameResult": "Game result",
      "casino.room.result.sections.fairnessData": "Fairness data",
      "casino.room.result.facts.status": "Status",
      "casino.room.result.facts.player": "Player",
      "casino.room.result.facts.multiplier": "Multiplier",
      "casino.room.result.facts.betAmount": "Bet amount",
      "casino.room.result.facts.payout": "Payout",
      "casino.room.result.facts.betId": "Bet ID",
      "casino.room.result.facts.refund": "Refund",
      "casino.room.result.facts.requestId": "Request ID",
      "casino.room.result.facts.netResult": "Net result",
      "casino.room.result.facts.randomHash": "Random hash",
      "casino.room.result.facts.settlementTx": "Settlement tx",
      "casino.room.result.facts.resolvedTime": "Resolved time",
      "casino.room.result.facts.vrfFee": "RNG fees (VRF)",
      "casino.room.result.facts.diceTarget": "Dice target",
      "casino.room.result.facts.diceNumber": "Number drawn",
      "casino.room.result.facts.coinChoice": "Chosen side",
      "casino.room.result.facts.coinDrawn": "Side drawn",
      "casino.room.result.facts.rouletteBet": "Roulette bet",
      "casino.room.result.facts.rouletteWinningNumber": "Winning number",
      "casino.room.result.facts.kenoPicked": "Numbers picked",
      "casino.room.result.facts.kenoDrawn": "Numbers drawn",
      "casino.room.result.facts.kenoHits": "Hits",
      "casino.room.result.actions.close": "Close",
      "casino.room.result.actions.viewSettlement": "View settlement"
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
  onResultClose: vi.fn(),
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
          player: "0xc8ec9920d573893e888db5d30b2b3b3824b1b684",
          stake: 10_000_000n,
          vrfFeeCharged: 100_000_000_000_000n,
          resolvedAt: 1_778_888_888,
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
    expect(screen.getAllByText("Won bet").length).toBeGreaterThan(0);
    expect(screen.getByText("Bet details")).toBeDefined();
    expect(screen.getByText("Game result")).toBeDefined();
    expect(screen.getByText("Fairness data")).toBeDefined();
    expect(screen.getByText("19.6 USDC")).toBeDefined();
    expect(screen.getByText("+ 9.6 USDC")).toBeDefined();
    expect(screen.getAllByText("17").length).toBeGreaterThan(0);
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
          player: "0xc8ec9920d573893e888db5d30b2b3b3824b1b684",
          stake: 10_000_000n
        }}
      />
    );

    expect(screen.queryByText("Bet details")).toBeNull();
    expect(screen.queryByText("Reading result")).toBeNull();
    expect(screen.queryByText("Won bet")).toBeNull();
  });
});

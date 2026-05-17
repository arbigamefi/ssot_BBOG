import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameRoomRightPane } from "./right-pane";

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
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

  it("does not present missing payout proof as a completed result", () => {
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

    expect(screen.getByText("Reading result")).toBeDefined();
    expect(screen.getByText("Fetching BetFinalized proof directly from GameHub.")).toBeDefined();
    expect(screen.queryByText("Settlement confirmed")).toBeNull();
  });
});

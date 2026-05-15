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
  expectedPayout: 19.8,
  onDiceDirectionChange: vi.fn(),
  onDiceTargetChange: vi.fn(),
  onRouletteChange: vi.fn(),
  onKenoChange: vi.fn(),
  onKenoResetResult: vi.fn()
};

describe("GameRoomRightPane", () => {
  afterEach(() => cleanup());

  it("renders the empty live tracker and dice stage", () => {
    render(<GameRoomRightPane {...baseProps} gameSlug="dice" />);

    expect(screen.getByText("RECENT ROLLS")).toBeDefined();
    expect(screen.getByText("Waiting for first play...")).toBeDefined();
    expect(screen.getByText("Roll Under")).toBeDefined();
  });

  it("renders chain bet status and result overlay", () => {
    render(
      <GameRoomRightPane
        {...baseProps}
        gameSlug="roulette"
        showResult
        resultNum={17}
        gameHistory={[{ val: 17, win: true }]}
        recentBets={[{ id: "84532:123456", betId: "123456", state: "finalized" }]}
      />
    );

    expect(screen.getByText("RECENT NUMBERS")).toBeDefined();
    expect(screen.getByText("SETTLED")).toBeDefined();
    expect(screen.getByText("Verification Success")).toBeDefined();
  });
});

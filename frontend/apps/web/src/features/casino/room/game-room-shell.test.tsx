import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameRoomShell } from "./game-room-shell";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "casino.room.shell.liveModule": "Live SSOT Module",
      "casino.room.shell.houseEdge": "House edge",
      "casino.room.shell.maxPayout": "Max payout"
    })[key] ?? key
}));

describe("GameRoomShell", () => {
  afterEach(() => cleanup());

  it("renders a tokenized game room frame with all three slots", () => {
    render(
      <GameRoomShell
        gameName="Precision Dice"
        houseEdge="1.00%"
        maxPayout="500 USDC"
        leftPaneContent={<div>Bet controls</div>}
        rightPaneContent={<div>Stage canvas</div>}
        auditLedgerContent={<div>Audit stream</div>}
        isInteractive
      />
    );

    expect(screen.getByRole("heading", { name: "Precision Dice" })).toBeDefined();
    expect(screen.getByText("Live SSOT Module")).toBeDefined();
    expect(screen.getByText("House edge")).toBeDefined();
    expect(screen.getByText("Max payout")).toBeDefined();
    expect(screen.getByText("Bet controls")).toBeDefined();
    expect(screen.getByText("Stage canvas")).toBeDefined();
    expect(screen.getByText("Audit stream")).toBeDefined();
  });
});

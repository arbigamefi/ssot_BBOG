import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SicBoStage } from "./sic-bo/stage";
import { applyHouseEdgeToMultiplier, sicBoMultiplier } from "../room/payouts";

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, number | string>) =>
    ({
      "casino.room.selection.sicBo.kinds.small": "Small",
      "casino.room.selection.sicBo.kinds.big": "Big",
      "casino.room.selection.sicBo.kinds.anyTriple": "Any triple",
      "casino.room.selection.sicBo.kinds.specificTriple": "Specific triple",
      "casino.room.selection.sicBo.kinds.total": "Exact total",
      "casino.room.selection.sicBo.kinds.specificDouble": "Specific double",
      "casino.room.selection.sicBo.kinds.singleFace": "Single face",
      "casino.room.stage.sicBo.ready": "Choose a Sic Bo table bet",
      "casino.room.stage.sicBo.rolling": "Waiting for VRF Oracle...",
      "casino.room.stage.sicBo.opened": `Dice opened: ${values?.dice}`,
      "casino.room.stage.sicBo.total": "Total",
      "casino.room.stage.sicBo.triple": "Triple",
      "casino.room.stage.sicBo.result": "Result",
      "casino.room.result.outcomes.win.label": "Won bet",
      "casino.room.result.outcomes.loss.label": "Lost bet",
      "casino.room.selection.sicBo.yes": "Yes",
      "casino.room.selection.sicBo.no": "No"
    })[key] ?? key
}));

describe("game room stages", () => {
  afterEach(() => cleanup());

  it("renders Sic Bo stage with opened dice and total", () => {
    const onBetChange = vi.fn();
    render(
      <SicBoStage
        isPending={false}
        showResult
        betKind="total"
        betValue={9}
        houseEdgeBps={200}
        onBetChange={onBetChange}
        outcome={{
          kind: "sic-bo",
          betKind: "total",
          betValue: 9,
          payoutGross: 8_640_000n,
          payoutNet: 8_467_200n,
          refundAmount: 0n,
          feeOnPayout: 172_800n,
          playerOwed: 8_467_200n,
          netResult: 7_467_200n,
          rolls: [
            {
              dice: [2, 3, 4],
              total: 9,
              triple: false,
              faceCount: 0,
              factorBps: 86_400,
              won: true
            }
          ]
        }}
      />
    );

    expect(screen.getByText("Dice opened: 2 / 3 / 4")).toBeDefined();
    expect(screen.getByText("Exact total 9")).toBeDefined();
    expect(
      screen.getAllByText(
        `${applyHouseEdgeToMultiplier(sicBoMultiplier("small", 0), 200).toFixed(2)}x`
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Won bet")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "12" }));
    expect(onBetChange).toHaveBeenCalledWith("total", 12);
  });

  it("runs Sic Bo reveal before opening the dice", () => {
    const onRevealComplete = vi.fn();
    vi.useFakeTimers();
    try {
      const sicBoOutcome = {
        kind: "sic-bo" as const,
        betKind: "small" as const,
        betValue: 0,
        payoutGross: 2_060_000n,
        payoutNet: 2_018_800n,
        refundAmount: 0n,
        feeOnPayout: 41_200n,
        playerOwed: 2_018_800n,
        netResult: 1_018_800n,
        rolls: [
          {
            dice: [1, 2, 3] as [number, number, number],
            total: 6,
            triple: false,
            faceCount: 0,
            factorBps: 20_600,
            won: true
          }
        ]
      };
      const { rerender } = render(
        <SicBoStage
          isPending={false}
          isRevealing
          showResult
          betKind="small"
          betValue={0}
          onBetChange={vi.fn()}
          onRevealComplete={onRevealComplete}
          outcome={sicBoOutcome}
        />
      );

      expect(screen.getByText("Waiting for VRF Oracle...")).toBeDefined();
      expect(screen.queryByText("Dice opened: 1 / 2 / 3")).toBeNull();
      expect(screen.queryByText("Won bet")).toBeNull();
      expect(
        Array.from(document.querySelectorAll("[data-won]")).every(
          (node) => node.getAttribute("data-won") === "false"
        )
      ).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1_600);
      });
      expect(onRevealComplete).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Dice opened: 1 / 2 / 3")).toBeNull();
      expect(screen.queryByText("Won bet")).toBeNull();
      expect(
        Array.from(document.querySelectorAll("[data-won]")).every(
          (node) => node.getAttribute("data-won") === "false"
        )
      ).toBe(true);

      rerender(
        <SicBoStage
          isPending={false}
          isRevealing={false}
          showResult
          betKind="small"
          betValue={0}
          onBetChange={vi.fn()}
          onRevealComplete={onRevealComplete}
          outcome={sicBoOutcome}
        />
      );
      expect(screen.getByText("Dice opened: 1 / 2 / 3")).toBeDefined();
      expect(screen.getByText("Won bet")).toBeDefined();
      expect(
        Array.from(document.querySelectorAll("[data-won]")).some(
          (node) => node.getAttribute("data-won") === "true"
        )
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

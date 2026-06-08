import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CasinoRoundStatusPanel } from "./round-status-panel";

vi.mock("@ssot/ui", () => ({
  cn: (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ")
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      "casino.room.roundStatus.title": "Round status",
      "casino.room.roundStatus.phases.ready.status": "Ready",
      "casino.room.roundStatus.phases.waitingVrf.status": "Waiting for draw",
      "casino.room.roundStatus.phases.settled.status": "Settled",
      "casino.room.roundStatus.metrics.vrfEstimate": "VRF estimate",
      "casino.room.roundStatus.metrics.betId": "Bet ID",
      "casino.room.roundStatus.metrics.vrfRequest": "VRF request"
    })[key] ?? key
}));

describe("CasinoRoundStatusPanel", () => {
  afterEach(() => cleanup());

  it("renders compact round proof data before a round starts", () => {
    render(<CasinoRoundStatusPanel phase="ready" quote={74100000000000n} />);

    expect(screen.getByText("Round status")).toBeDefined();
    expect(screen.getByText("Ready")).toBeDefined();
    expect(screen.getByText("VRF estimate")).toBeDefined();
    expect(screen.getByText("0.0000741 ETH")).toBeDefined();
    expect(screen.getByText("Bet ID")).toBeDefined();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("shows mined bet and VRF request ids without reintroducing the stepper", () => {
    render(
      <CasinoRoundStatusPanel
        phase="waiting_vrf"
        quote={74100000000000n}
        betId={28n}
        requestId={104964872007376604112859092387372891991342602865639700265695114041332312851084n}
      />
    );

    expect(screen.getByText("Waiting for draw")).toBeDefined();
    expect(screen.getByText("28")).toBeDefined();
    expect(
      screen.getByText(
        "104964872007376604112859092387372891991342602865639700265695114041332312851084"
      )
    ).toBeDefined();
    expect(screen.queryByText("place")).toBeNull();
    expect(screen.queryByText("settle")).toBeNull();
  });

  it("keeps the status tag for terminal phases", () => {
    render(<CasinoRoundStatusPanel phase="settled" />);

    expect(screen.getByText("Settled")).toBeDefined();
  });
});

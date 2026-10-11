import { describe, expect, it } from "vitest";

import { buildLifecycleSteps, eventStatus, getStateLabel } from "./lifecycle";

const labels = {
  won: "Won",
  lost: "Lost",
  randomReady: "Random ready",
  placed: "Placed",
  refunded: "Refund settled",
  voided: "Voided",
  pending: "Pending"
};

describe("bet detail lifecycle", () => {
  it("labels a voided bet and never shows a raw state name", () => {
    expect(getStateLabel("voided", null, labels)).toBe("Voided");
    expect(getStateLabel("somethingNew", null, labels)).toBe("Pending");
  });

  it("shows placement, randomness and the returned stake for a void", () => {
    const steps = buildLifecycleSteps("voided", {
      placed: "Placed",
      placedDescription: "p",
      randomReady: "Random ready",
      randomReadyDescription: "r",
      finalized: "Finalized",
      finalizedDescription: "f",
      refunded: "Refund settled",
      refundedDescription: "x",
      voided: "Stake returned",
      voidedDescription: "v"
    });
    expect(steps.map((step) => [step.title, step.state])).toEqual([
      ["Placed", "done"],
      ["Random ready", "done"],
      ["Stake returned", "done"]
    ]);
    expect(eventStatus("BetVoided")).toBe("reconciled");
  });
});

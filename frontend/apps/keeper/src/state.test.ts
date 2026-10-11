import { describe, expect, it } from "vitest";
import { isTerminalState, mapBetState, mapRequestState, shouldFinalize } from "./state.js";

describe("keeper state helpers", () => {
  it("maps SSOTTypes.BetState numeric values", () => {
    expect(mapBetState(2)).toBe("pendingVrf");
    expect(mapBetState(3)).toBe("randomReady");
    expect(mapBetState(4)).toBe("settled");
    expect(mapBetState(5)).toBe("refunded");
    expect(mapBetState(6)).toBe("voided");
  });

  it("maps IVRFHub.RequestState numeric values, Voided appended", () => {
    expect(["none", "awaiting", "received", "terminal", "cancelled", "voided"]).toEqual(
      [0, 1, 2, 3, 4, 5].map(mapRequestState)
    );
  });

  it.each([7, -1, 1.5, Number.NaN])("fails loudly on unknown state %s", (state) => {
    expect(() => mapBetState(state)).toThrow(/Unknown GameHub bet state/);
    expect(() => mapRequestState(state + 0)).toThrow(/Unknown canonical VRF request state/);
  });

  it("only finalizes random-ready bets", () => {
    expect(shouldFinalize("randomReady")).toBe(true);
    expect(shouldFinalize("pendingVrf")).toBe(false);
    expect(isTerminalState("settled")).toBe(true);
  });

  it("treats a void as terminal", () => {
    expect(isTerminalState("voided")).toBe(true);
    expect(isTerminalState("refunded")).toBe(true);
    expect(isTerminalState("randomReady")).toBe(false);
    expect(isTerminalState("pendingVrf")).toBe(false);
  });
});

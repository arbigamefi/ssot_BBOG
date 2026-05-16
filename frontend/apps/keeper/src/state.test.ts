import { describe, expect, it } from "vitest";
import { isTerminalState, mapBetState, shouldFinalize } from "./state.js";

describe("keeper state helpers", () => {
  it("maps SSOTTypes.BetState numeric values", () => {
    expect(mapBetState(2)).toBe("pendingVrf");
    expect(mapBetState(3)).toBe("randomReady");
    expect(mapBetState(4)).toBe("settled");
    expect(mapBetState(5)).toBe("refunded");
  });

  it("only finalizes random-ready bets", () => {
    expect(shouldFinalize("randomReady")).toBe(true);
    expect(shouldFinalize("pendingVrf")).toBe(false);
    expect(isTerminalState("settled")).toBe(true);
  });
});

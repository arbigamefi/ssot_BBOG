import { describe, expect, it } from "vitest";
import { gameHubRoundEventMatchesBet } from "@ssot/ssot/sdk";

import {
  deriveCasinoRoundPhase,
  formatNativeFee,
  getCasinoRoundReadErrorMessage,
  isBetNotFoundError,
  shouldDeferCasinoRoundReadError
} from "./casino-round";

describe("casino round helpers", () => {
  it("derives live settlement phases from on-chain bet state", () => {
    expect(
      deriveCasinoRoundPhase({
        betState: "placed",
        placedAt: 9,
        now: 10_000
      })
    ).toBe("waiting_vrf");

    expect(
      deriveCasinoRoundPhase({
        betState: "placed",
        placedAt: 1,
        now: 62_000,
        softVrfTimeoutMs: 60_000,
        refundTimeoutSeconds: 3_600
      })
    ).toBe("timeout_soft");

    expect(
      deriveCasinoRoundPhase({
        betState: "placed",
        placedAt: 1,
        now: 3_602_000,
        refundTimeoutSeconds: 3_600
      })
    ).toBe("refundable");

    expect(
      deriveCasinoRoundPhase({
        betState: "randomReady",
        randomReadyAt: 1_000,
        now: 20_000,
        manualSettleDelayMs: 30_000
      })
    ).toBe("settling");

    expect(
      deriveCasinoRoundPhase({
        betState: "randomReady",
        randomReadyAt: 1_000,
        now: 40_000,
        manualSettleDelayMs: 30_000
      })
    ).toBe("manual_settle_offered");
  });

  it("maps terminal bet states", () => {
    expect(deriveCasinoRoundPhase({ betState: "finalized", now: 1 })).toBe("settled");
    expect(deriveCasinoRoundPhase({ betState: "refunded", now: 1 })).toBe("refundable");
  });

  it("formats native VRF fees without scientific notation", () => {
    expect(formatNativeFee(73_169_600_001_705n)).toBe("0.00007316 ETH");
    expect(formatNativeFee(undefined)).toBe("—");
  });

  it("maps chain read failures to product copy", () => {
    const rawViemError = new Error(
      'The contract function "getBet" reverted. Error: BetNotFound(uint256 positionId) (13)'
    );

    expect(isBetNotFoundError(rawViemError)).toBe(true);
    expect(
      getCasinoRoundReadErrorMessage({
        error: rawViemError,
        fallback: "Unable to read the live round state.",
        betNotFoundFallback: "This round was not found on the current GameHub."
      })
    ).toBe("This round was not found on the current GameHub.");

    expect(
      getCasinoRoundReadErrorMessage({
        error: new Error("network changed"),
        fallback: "Unable to read the live round state.",
        betNotFoundFallback: "This round was not found on the current GameHub."
      })
    ).toBe("Unable to read the live round state.");
  });

  it("defers early BetNotFound reads while RPC state catches up", () => {
    const rawViemError = new Error(
      'The contract function "getBet" reverted. Error: BetNotFound(uint256 positionId) (5)'
    );

    expect(
      shouldDeferCasinoRoundReadError({
        error: rawViemError,
        startedAt: 10_000,
        now: 20_000,
        graceMs: 15_000
      })
    ).toBe(true);

    expect(
      shouldDeferCasinoRoundReadError({
        error: rawViemError,
        startedAt: 10_000,
        now: 30_001,
        graceMs: 15_000
      })
    ).toBe(false);
  });

  it("matches decoded casino round events by indexed position id", () => {
    expect(gameHubRoundEventMatchesBet({ args: { positionId: 7n } }, 7n)).toBe(true);
    expect(gameHubRoundEventMatchesBet({ args: { positionId: "7" } }, 7n)).toBe(true);
    expect(gameHubRoundEventMatchesBet({ args: { positionId: 8n } }, 7n)).toBe(false);
    expect(gameHubRoundEventMatchesBet({ args: {} }, 7n)).toBe(false);
    expect(gameHubRoundEventMatchesBet({ args: { positionId: "not-a-number" } }, 7n)).toBe(false);
  });
});

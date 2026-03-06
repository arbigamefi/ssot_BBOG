import { describe, expect, it } from "vitest";

import { initialBetStepperState, reduceBetStepper } from "./stepperMachine";

const dummyPlan = (needsApproval: boolean) =>
  ({
    chainId: 84532,
    releaseDigest: "0xdeadbeef",
    warnings: [],
    steps: [],
    payload: {
      gameId: "0x" as any,
      asset: "0x" as any,
      params: "0x" as any,
      stakeSpec: { amountPerRoll: 1n, betCount: 1, stopGain: 0n, stopLoss: 0n },
      affiliate: "0x" as any,
      maxHouseEdgeBps: 100,
    },
    preview: { vrfFee: 1n, stake: 1n, allowance: 0n, needsApproval, approveAmount: needsApproval ? 1n : undefined },
  }) as any;

const dummyError = (code: string) => ({
  code,
  message: `Error: ${code}`,
  severity: "error" as const,
});

describe("bet stepper machine", () => {
  // ——— Happy path ———
  it("goes idle -> planning -> needs-approval", () => {
    let s = initialBetStepperState;
    s = reduceBetStepper(s, { type: "PLAN_START" });
    expect(s.status).toBe("planning");
    s = reduceBetStepper(s, { type: "PLAN_SUCCESS", plan: dummyPlan(true) });
    expect(s.status).toBe("needs-approval");
  });

  it("goes idle -> planning -> ready", () => {
    let s = initialBetStepperState;
    s = reduceBetStepper(s, { type: "PLAN_START" });
    s = reduceBetStepper(s, { type: "PLAN_SUCCESS", plan: dummyPlan(false) });
    expect(s.status).toBe("ready");
  });

  it("execute success with betId -> reconciled", () => {
    let s = reduceBetStepper(initialBetStepperState, { type: "PLAN_SUCCESS", plan: dummyPlan(false) });
    s = reduceBetStepper(s, { type: "EXECUTE_START" });
    s = reduceBetStepper(s, {
      type: "EXECUTE_SUCCESS",
      result: { placeBetTx: { txHash: "0x" as any, ok: true }, betId: 123n },
    });
    expect(s.status).toBe("reconciled");
    expect(s.betId).toBe(123n);
  });

  it("execute success without betId -> mined", () => {
    let s = reduceBetStepper(initialBetStepperState, { type: "PLAN_SUCCESS", plan: dummyPlan(false) });
    s = reduceBetStepper(s, { type: "EXECUTE_START" });
    s = reduceBetStepper(s, {
      type: "EXECUTE_SUCCESS",
      result: { placeBetTx: { txHash: "0x" as any, ok: true } },
    });
    expect(s.status).toBe("mined");
  });

  // ——— Error paths ———
  it("PLAN_ERROR -> failed with error", () => {
    let s = reduceBetStepper(initialBetStepperState, { type: "PLAN_START" });
    const error = dummyError("CHAIN_MISMATCH");
    s = reduceBetStepper(s, { type: "PLAN_ERROR", error });
    expect(s.status).toBe("failed");
    expect(s.error).toBe(error);
  });

  it("EXECUTE_ERROR -> failed with error, preserves plan", () => {
    const plan = dummyPlan(false);
    let s = reduceBetStepper(initialBetStepperState, { type: "PLAN_SUCCESS", plan });
    s = reduceBetStepper(s, { type: "EXECUTE_START" });
    expect(s.status).toBe("submitting");
    expect(s.plan).toBe(plan);

    const error = dummyError("USER_REJECTED");
    s = reduceBetStepper(s, { type: "EXECUTE_ERROR", error });
    expect(s.status).toBe("failed");
    expect(s.error).toBe(error);
    expect(s.plan).toBe(plan);
  });

  // ——— EXECUTE_START clears previous error ———
  it("EXECUTE_START clears error from previous attempt", () => {
    let s = reduceBetStepper(initialBetStepperState, { type: "PLAN_SUCCESS", plan: dummyPlan(false) });
    s = reduceBetStepper(s, { type: "EXECUTE_START" });
    s = reduceBetStepper(s, { type: "EXECUTE_ERROR", error: dummyError("FAIL") });
    expect(s.error).toBeDefined();

    s = reduceBetStepper(s, { type: "EXECUTE_START" });
    expect(s.status).toBe("submitting");
    expect(s.error).toBeUndefined();
  });

  // ——— Reconciliation flow ———
  it("mined -> RECONCILE_START clears error, keeps mined status", () => {
    let s = reduceBetStepper(initialBetStepperState, { type: "PLAN_SUCCESS", plan: dummyPlan(false) });
    s = reduceBetStepper(s, { type: "EXECUTE_START" });
    s = reduceBetStepper(s, {
      type: "EXECUTE_SUCCESS",
      result: { placeBetTx: { txHash: "0x" as any, ok: true } },
    });
    expect(s.status).toBe("mined");

    s = reduceBetStepper(s, { type: "RECONCILE_START" });
    expect(s.status).toBe("mined");
    expect(s.error).toBeUndefined();
  });

  it("mined -> RECONCILE_SUCCESS -> reconciled with betId", () => {
    let s = reduceBetStepper(initialBetStepperState, { type: "PLAN_SUCCESS", plan: dummyPlan(false) });
    s = reduceBetStepper(s, { type: "EXECUTE_START" });
    s = reduceBetStepper(s, {
      type: "EXECUTE_SUCCESS",
      result: { placeBetTx: { txHash: "0x" as any, ok: true } },
    });
    s = reduceBetStepper(s, { type: "RECONCILE_SUCCESS", betId: 456n });
    expect(s.status).toBe("reconciled");
    expect(s.betId).toBe(456n);
  });

  it("mined -> RECONCILE_ERROR stays mined but surfaces error", () => {
    let s = reduceBetStepper(initialBetStepperState, { type: "PLAN_SUCCESS", plan: dummyPlan(false) });
    s = reduceBetStepper(s, { type: "EXECUTE_START" });
    s = reduceBetStepper(s, {
      type: "EXECUTE_SUCCESS",
      result: { placeBetTx: { txHash: "0x" as any, ok: true } },
    });
    const error = dummyError("BET_ID_NOT_FOUND");
    s = reduceBetStepper(s, { type: "RECONCILE_ERROR", error });
    expect(s.status).toBe("mined");
    expect(s.error).toBe(error);
  });

  // ——— RESET ———
  it("RESET returns to idle from any state", () => {
    let s = reduceBetStepper(initialBetStepperState, { type: "PLAN_SUCCESS", plan: dummyPlan(true) });
    expect(s.status).toBe("needs-approval");
    s = reduceBetStepper(s, { type: "RESET" });
    expect(s.status).toBe("idle");
    expect(s.plan).toBeUndefined();
    expect(s.error).toBeUndefined();
  });

  it("RESET from failed state clears error", () => {
    let s = reduceBetStepper(initialBetStepperState, { type: "PLAN_START" });
    s = reduceBetStepper(s, { type: "PLAN_ERROR", error: dummyError("RPC_ERROR") });
    expect(s.error).toBeDefined();
    s = reduceBetStepper(s, { type: "RESET" });
    expect(s).toEqual({ status: "idle" });
  });

  // ——— Unknown event ———
  it("returns current state for unknown event types", () => {
    const s = initialBetStepperState;
    const next = reduceBetStepper(s, { type: "NONEXISTENT" } as any);
    expect(next).toBe(s);
  });

  // ——— Initial state ———
  it("initialBetStepperState is idle", () => {
    expect(initialBetStepperState.status).toBe("idle");
  });
});

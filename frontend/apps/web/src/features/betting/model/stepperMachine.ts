import type { DomainError } from "@ssot/ssot";
import type { ExecutePlanResult, PlaceBetPlan } from "@ssot/ssot";

export type BetStepperStatus =
  | "idle"
  | "planning"
  | "needs-approval"
  | "ready"
  | "submitting"
  | "mined"
  | "reconciled"
  | "failed";

export type BetStepperState = {
  status: BetStepperStatus;
  plan?: PlaceBetPlan;
  result?: ExecutePlanResult;
  betId?: bigint;
  error?: DomainError;
  executionStage?: "approve" | "placeBet";
};

export type BetStepperEvent =
  | { type: "RESET" }
  | { type: "PLAN_START" }
  | { type: "PLAN_SUCCESS"; plan: PlaceBetPlan }
  | { type: "PLAN_ERROR"; error: DomainError }
  | { type: "EXECUTE_START" }
  | { type: "EXECUTE_STAGE"; stage: "approve" | "placeBet" }
  | { type: "EXECUTE_SUCCESS"; result: ExecutePlanResult }
  | { type: "EXECUTE_ERROR"; error: DomainError; result?: ExecutePlanResult }
  | { type: "RECONCILE_START" }
  | { type: "RECONCILE_SUCCESS"; betId: bigint }
  | { type: "RECONCILE_ERROR"; error: DomainError };

export const initialBetStepperState: BetStepperState = { status: "idle" };

export function reduceBetStepper(state: BetStepperState, event: BetStepperEvent): BetStepperState {
  switch (event.type) {
    case "RESET":
      return { status: "idle" };
    case "PLAN_START":
      return { status: "planning" };
    case "PLAN_SUCCESS": {
      const needsApproval = event.plan.preview.needsApproval;
      return {
        status: needsApproval ? "needs-approval" : "ready",
        plan: event.plan
      };
    }
    case "PLAN_ERROR":
      return { status: "failed", error: event.error };
    case "EXECUTE_START":
      return { ...state, status: "submitting", error: undefined, executionStage: undefined };
    case "EXECUTE_STAGE":
      return { ...state, executionStage: event.stage };
    case "EXECUTE_SUCCESS": {
      const betId = event.result.betId;
      if (betId !== undefined) {
        return { ...state, status: "reconciled", result: event.result, betId };
      }
      // Mined but not yet reconciled (no betId extracted from receipt)
      return { ...state, status: "mined", result: event.result };
    }
    case "EXECUTE_ERROR":
      return { ...state, status: "failed", error: event.error, result: event.result };
    case "RECONCILE_START":
      // Keep mined status; clear transient error.
      return { ...state, status: "mined", error: undefined };
    case "RECONCILE_ERROR":
      // Only a confirmed revert makes a fresh submission safe.
      return {
        ...state,
        status: event.error.code === "TX_REVERTED" ? "failed" : "mined",
        error: event.error
      };
    case "RECONCILE_SUCCESS":
      return { ...state, status: "reconciled", betId: event.betId };
    default:
      return state;
  }
}

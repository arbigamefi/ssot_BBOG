import { useCallback, useMemo, useReducer, useState } from "react";

import type { DomainError, PlaceBetInput, PlaceBetPlan } from "@ssot/ssot";

import { useSSOTSDK } from "../../ssot/sdk";
import {
  initialBetStepperState,
  reduceBetStepper,
  type BetStepperState
} from "./model/stepperMachine";

// Keep SDK runtime code out of the room's initial bundle; providers already
// load it on demand, and classification is only needed on an exceptional path.
async function classifyError(error: unknown) {
  const { toDomainError } = await import("@ssot/ssot/sdk");
  return toDomainError(error);
}

export type UsePlaceBetStepperReturn = {
  state: BetStepperState;
  plan: PlaceBetPlan | undefined;
  planNow: (input: PlaceBetInput) => Promise<PlaceBetPlan | undefined>;
  executeNow: (planOverride?: PlaceBetPlan, shouldContinue?: () => boolean) => Promise<void>;

  /** Retry reconcile for mined-but-unreconciled placeBet tx. */
  reconcileNow: () => Promise<void>;
  /** Manual bind betId (must be owned by the connected wallet). */
  bindNow: (betId: bigint) => Promise<void>;

  reconciling: boolean;
  binding: boolean;

  reset: () => void;
};

export type UsePlaceBetStepperMessages = {
  sdkNotReady?: string;
  transactionFailed?: string;
  reconcileFailed?: string;
  bindFailed?: string;
};

export function usePlaceBetStepper(
  messages: UsePlaceBetStepperMessages = {}
): UsePlaceBetStepperReturn {
  const { sdk } = useSSOTSDK();
  const sdkNotReadyMessage = messages.sdkNotReady ?? "—";
  const transactionFailedMessage = messages.transactionFailed ?? "—";
  const reconcileFailedMessage = messages.reconcileFailed ?? "—";
  const bindFailedMessage = messages.bindFailed ?? "—";

  const noopError: DomainError = useMemo(
    () => ({
      code: "SDK_NOT_READY",
      message: sdkNotReadyMessage,
      severity: "warning"
    }),
    [sdkNotReadyMessage]
  );

  const [state, dispatch] = useReducer(reduceBetStepper, initialBetStepperState);

  const [reconciling, setReconciling] = useState(false);
  const [binding, setBinding] = useState(false);

  const unknownTxError = useCallback(
    (message: string): DomainError => ({
      code: "TX_FAILED",
      message,
      severity: "error",
      retryable: true
    }),
    []
  );

  const planNow = useCallback(
    async (input: PlaceBetInput) => {
      if (!sdk) {
        dispatch({ type: "PLAN_ERROR", error: noopError });
        return undefined;
      }
      dispatch({ type: "PLAN_START" });
      let res;
      try {
        res = await sdk.gameHub.planPlaceBet(input);
      } catch (error) {
        dispatch({ type: "PLAN_ERROR", error: await classifyError(error) });
        return undefined;
      }
      if ("error" in res) {
        dispatch({ type: "PLAN_ERROR", error: res.error as DomainError });
        return undefined;
      }
      dispatch({ type: "PLAN_SUCCESS", plan: res });
      return res;
    },
    [sdk, noopError]
  );

  const executeNow = useCallback(
    async (planOverride?: PlaceBetPlan, shouldContinue?: () => boolean) => {
      if (!sdk) {
        dispatch({ type: "EXECUTE_ERROR", error: noopError });
        return;
      }
      const plan = planOverride ?? state.plan;
      if (!plan) return;
      dispatch({ type: "EXECUTE_START" });
      try {
        const result = await sdk.gameHub.executePlan(plan, (stage) => {
          if (shouldContinue && !shouldContinue())
            throw Object.assign(new Error("Bet context changed"), {
              name: "BetContextChangedError"
            });
          dispatch({ type: "EXECUTE_STAGE", stage });
        });
        if (!result.placeBetTx.ok) {
          const error: DomainError =
            result.placeBetTx.error ?? unknownTxError(transactionFailedMessage);
          dispatch({ type: "EXECUTE_ERROR", error, result });
          return;
        }
        dispatch({ type: "EXECUTE_SUCCESS", result });
      } catch (e) {
        const classified = await classifyError(e);
        const error: DomainError = ["RPC_ERROR", "UNKNOWN"].includes(classified.code)
          ? { ...classified, code: "TX_STATUS_UNKNOWN", retryable: false }
          : classified;
        dispatch({ type: "EXECUTE_ERROR", error });
      }
    },
    [sdk, state.plan, unknownTxError, noopError, transactionFailedMessage]
  );

  const reconcileNow = useCallback(async () => {
    if (!sdk) return;
    const txHash = state.result?.placeBetTx?.txHash;
    if (!txHash || txHash === ("0x0" as any)) return;

    setReconciling(true);
    dispatch({ type: "RECONCILE_START" });
    try {
      const res = await sdk.gameHub.reconcilePlaceBetTx(txHash as any);
      if (res.ok) {
        dispatch({ type: "RECONCILE_SUCCESS", betId: res.betId });
      } else {
        dispatch({
          type: "RECONCILE_ERROR",
          error: {
            ...res.error,
            details: { ...res.error.details, ...state.error?.details, txHash }
          }
        });
      }
    } catch (e) {
      dispatch({
        type: "RECONCILE_ERROR",
        error: {
          code: "TX_STATUS_UNKNOWN",
          message: reconcileFailedMessage,
          severity: "warning",
          retryable: false,
          details: {
            ...state.error?.details,
            chainId: state.plan?.chainId,
            action: "PLACE_BET",
            txHash
          }
        }
      });
    } finally {
      setReconciling(false);
    }
  }, [sdk, state.result, state.error, state.plan?.chainId, reconcileFailedMessage]);

  const bindNow = useCallback(
    async (betId: bigint) => {
      if (!sdk) return;
      const txHash = state.result?.placeBetTx?.txHash;
      if (!txHash || txHash === ("0x0" as any)) return;

      setBinding(true);
      dispatch({ type: "RECONCILE_START" });
      try {
        const res = await sdk.gameHub.bindPlaceBetTx(txHash as any, betId);
        if (res.ok) {
          dispatch({ type: "RECONCILE_SUCCESS", betId: res.betId });
        } else {
          dispatch({ type: "RECONCILE_ERROR", error: res.error });
        }
      } catch (e) {
        dispatch({
          type: "RECONCILE_ERROR",
          error: unknownTxError((e as Error)?.message ?? bindFailedMessage)
        });
      } finally {
        setBinding(false);
      }
    },
    [sdk, state.result, unknownTxError, bindFailedMessage]
  );

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    state: state as BetStepperState,
    plan: state.plan,
    planNow,
    executeNow,
    reconcileNow,
    bindNow,
    reconciling,
    binding,
    reset
  };
}

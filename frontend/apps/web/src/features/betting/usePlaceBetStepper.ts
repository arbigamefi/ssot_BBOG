import { useCallback, useReducer, useState } from "react";

import type { DomainError, PlaceBetInput, PlaceBetPlan } from "@ssot/ssot";

import { useSSOTSDK } from "../../ssot/sdk";
import {
  initialBetStepperState,
  reduceBetStepper,
  type BetStepperState
} from "./model/stepperMachine";

export type UsePlaceBetStepperReturn = {
  state: BetStepperState;
  plan: PlaceBetPlan | undefined;
  planNow: (input: PlaceBetInput) => Promise<void>;
  executeNow: () => Promise<void>;

  /** Retry reconcile for mined-but-unreconciled placeBet tx. */
  reconcileNow: () => Promise<void>;
  /** Manual bind betId (must be owned by the connected wallet). */
  bindNow: (betId: bigint) => Promise<void>;

  reconciling: boolean;
  binding: boolean;

  reset: () => void;
};

export function usePlaceBetStepper(): UsePlaceBetStepperReturn {
  const { sdk } = useSSOTSDK();

  const noopError: DomainError = {
    code: "SDK_NOT_READY",
    message: "SSOT SDK is not ready. Please connect your wallet.",
    severity: "warning"
  };

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
        return;
      }
      dispatch({ type: "PLAN_START" });
      const res = await sdk.gameHub.planPlaceBet(input);
      if ("error" in res) {
        dispatch({ type: "PLAN_ERROR", error: res.error as DomainError });
        return;
      }
      dispatch({ type: "PLAN_SUCCESS", plan: res });
    },
    [sdk, noopError]
  );

  const executeNow = useCallback(async () => {
    if (!sdk) {
      dispatch({ type: "EXECUTE_ERROR", error: noopError });
      return;
    }
    if (!state.plan) return;
    dispatch({ type: "EXECUTE_START" });
    try {
      const result = await sdk.gameHub.executePlan(state.plan);
      if (!result.placeBetTx.ok) {
        const error: DomainError = result.placeBetTx.error ?? unknownTxError("Transaction failed");
        dispatch({ type: "EXECUTE_ERROR", error });
        return;
      }
      dispatch({ type: "EXECUTE_SUCCESS", result });
    } catch (e) {
      const error: DomainError = unknownTxError((e as Error)?.message ?? "Transaction failed");
      dispatch({ type: "EXECUTE_ERROR", error });
    }
  }, [sdk, state.plan, unknownTxError, noopError]);

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
        dispatch({ type: "RECONCILE_ERROR", error: res.error });
      }
    } catch (e) {
      dispatch({
        type: "RECONCILE_ERROR",
        error: unknownTxError((e as Error)?.message ?? "Reconcile failed")
      });
    } finally {
      setReconciling(false);
    }
  }, [sdk, state.result, unknownTxError]);

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
          error: unknownTxError((e as Error)?.message ?? "Bind failed")
        });
      } finally {
        setBinding(false);
      }
    },
    [sdk, state.result, unknownTxError]
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

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import type { SSOTSDK } from "@ssot/ssot/sdk";
import { toast } from "@ssot/ui";

import { useDirectTxAction } from "../tx/useDirectTxAction";
import { getEarnRedemptionView } from "./earn-redemption-panel";

export type EarnAsyncAction = "request" | "cancel" | "claim" | "player" | "recovery";

const FLOW_ACTION: Record<EarnAsyncAction, string> = {
  request: "REQUEST_REDEEM",
  cancel: "CANCEL_REDEEM",
  claim: "REDEEM",
  player: "CLAIM_PLAYER_PAYABLE",
  recovery: "CLAIM_RECOVERY"
};

const SUCCESS_KEY: Record<EarnAsyncAction, string> = {
  request: "earn.async.requested",
  cancel: "earn.async.cancelled",
  claim: "earn.async.claimed",
  player: "earn.async.playerClaimed",
  recovery: "earn.recovery.claimed"
};

type Options = {
  sdk?: SSOTSDK;
  poolId?: number;
  bankAddress?: string;
  enabled: boolean;
  /** Read at call time: another Earn transaction flow is in progress. */
  otherFlowBusy: React.RefObject<boolean>;
};

/**
 * Redemption requests, cancellation and the three pull claims (priced exits, player payables, historical
 * recovery). Each action re-reads the Bank at one block and re-checks its precondition before sending.
 */
export function useEarnAsyncActions({ sdk, poolId, bankAddress, enabled, otherFlowBusy }: Options) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [flowAction, setFlowAction] = React.useState(FLOW_ACTION.request);
  const busyRef = React.useRef(false);
  const flow = useDirectTxAction({
    action: flowAction,
    errorMessage: t("app.errors.transactionFailed"),
    labels: {
      preflight: t("earn.flows.preflight.title"),
      submit: t("earn.flows.direct.submit"),
      confirm: t("earn.flows.direct.confirm")
    }
  });

  const run = async (action: EarnAsyncAction, shares?: bigint, epochId?: bigint) => {
    if (!sdk?.account || !poolId || !enabled || busyRef.current || otherFlowBusy.current) return;
    busyRef.current = true;
    setBusy(true);
    let toastId: string | number | undefined;
    try {
      const account = sdk.account;
      const snapshot = await sdk.bank.getSnapshot(poolId);
      if (snapshot.bank?.toLowerCase() !== bankAddress) throw new Error(t("earn.async.unknown"));
      const position = await sdk.bank.getPosition(poolId, account, {
        blockNumber: snapshot.updatedAtBlock
      });
      const fresh = getEarnRedemptionView(snapshot, position);
      if (!fresh) throw new Error(t("earn.async.unknown"));
      if ((action === "claim" || action === "recovery") && fresh.paused)
        throw new Error(t("earn.async.paused"));
      if (action === "request" && (shares == null || shares <= 0n || shares > fresh.walletShares))
        throw new Error(t("earn.errors.exceedsRedeemable"));
      if (action === "cancel" && fresh.cancellableShares === 0n)
        throw new Error(t("earn.async.cancelDetail"));
      if (action === "claim" && fresh.claimableShares === 0n) return;
      if (action === "player" && (position.playerPayable ?? 0n) === 0n) return;
      if (action === "recovery") {
        if (epochId == null) return;
        const right = await sdk.bank.getRecovery(poolId, epochId, account, {
          blockNumber: snapshot.updatedAtBlock
        });
        if (right.updatedAtBlock !== snapshot.updatedAtBlock || right.epochId !== epochId)
          throw new Error(t("earn.recovery.error"));
        if (right.claimableAssets <= 0n) return;
      }
      toastId = toast.loading(t("earn.toast.processing"));
      setFlowAction(FLOW_ACTION[action]);
      const result = await flow.execute(() =>
        action === "request"
          ? sdk.bank.requestRedeem(poolId, shares!, account, account)
          : action === "cancel"
            ? sdk.bank.cancelRedeemRequest(poolId, account)
            : action === "recovery"
              ? sdk.bank.claimRecovery(poolId, epochId!, account, account)
              : action === "player"
                ? sdk.bank.claimPlayerPayable(poolId, account)
                : sdk.bank.redeem(poolId, fresh.claimableShares, account, account)
      );
      if (!result.ok) throw new Error(result.error?.message ?? t("earn.toast.failed"));
      toast.success(t(SUCCESS_KEY[action]), { id: toastId });
      toastId = undefined;
    } catch (error) {
      toast.error((error as Error)?.message ?? t("earn.toast.failed"));
    } finally {
      if (toastId != null) toast.dismiss(toastId);
      await queryClient.invalidateQueries({ queryKey: ["ssot", "earn"] });
      busyRef.current = false;
      setBusy(false);
    }
  };

  return { busy, busyRef, flow, run };
}

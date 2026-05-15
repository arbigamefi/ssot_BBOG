"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import { toast, type TxStatus } from "@ssot/ui";

import { PageTransition } from "../../../../components/PageTransition";
import { Placeholder } from "../../../../components/Placeholder";
import { ClaimsActionPanel } from "../../../../features/portfolio/claims/claims-action-panel";
import { ClaimsBuckets } from "../../../../features/portfolio/claims/claims-buckets";
import { ClaimsHero } from "../../../../features/portfolio/claims/claims-hero";
import {
  ClaimsJournal,
  type ClaimsJournalRow
} from "../../../../features/portfolio/claims/claims-journal";
import {
  formatTokenAmount,
  getExplorerBaseUrl,
  shortHex
} from "../../../../features/portfolio/claims/format";
import type {
  ClaimsAction,
  ClaimsFlowState,
  ClaimsMetric
} from "../../../../features/portfolio/claims/types";
import { formatUnits, parseDecimalToUnits } from "../../../../features/betting/model/units";
import { useDirectTxAction } from "../../../../features/tx/useDirectTxAction";
import { useRelease } from "../../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../../ssot/sdk";

export function ClaimsPageClient() {
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);
  const assetMeta = release?.assets[0];
  const asset = assetMeta?.address as Address | undefined;
  const claimsPool =
    release?.pools.find((pool) => pool.active && String(pool.domain).toLowerCase() === "casino") ??
    release?.pools[0];
  const poolId = claimsPool?.poolId;
  const decimals = assetMeta?.decimals ?? 18;
  const symbol = assetMeta?.symbol ?? "XP";

  const xpClaimFlow = useDirectTxAction({
    action: "CLAIM_XP_ACCRUED",
    labels: {
      preflight: "Preflight",
      submit: "Submit claim",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Simulate claim call.",
      submit: "Broadcast claimXPAccrued.",
      confirm: "Wait for receipt."
    }
  });

  const syncHoldbackFlow = useDirectTxAction({
    action: "SYNC_XP_HOLDBACK",
    labels: {
      preflight: "Preflight",
      submit: "Submit sync",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate sync action.",
      submit: "Broadcast syncXPHoldback.",
      confirm: "Wait for receipt."
    }
  });

  const protocolFeeFlow = useDirectTxAction({
    action: "CLAIM_PROTOCOL_FEES",
    labels: {
      preflight: "Preflight",
      submit: "Submit claim",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate governance call.",
      submit: "Broadcast claimProtocolFees.",
      confirm: "Wait for receipt."
    }
  });

  const {
    data: xpBuckets,
    isLoading: xpLoading,
    error: xpError,
    refetch: refetchXP
  } = useQuery({
    queryKey: ["ssot", "claims", "xp", chainId, poolId, sdk?.account ?? "anonymous"],
    enabled: Boolean(sdk?.account && ready && poolId),
    queryFn: async () => {
      if (!sdk?.account) throw new Error("Wallet unavailable");
      if (!poolId) throw new Error("Pool unavailable");
      return sdk.bank.getXPBuckets(poolId, sdk.account);
    },
    refetchInterval: 8_000
  });

  const { data: snapshot, refetch: refetchSnapshot } = useQuery({
    queryKey: ["ssot", "claims", "bank", chainId, poolId],
    enabled: Boolean(sdk && ready && asset && poolId),
    queryFn: async () => {
      if (!sdk || !asset) throw new Error("Bank unavailable");
      if (!poolId) throw new Error("Pool unavailable");
      return sdk.bank.getSnapshot(poolId);
    },
    refetchInterval: 8_000
  });

  const [activeAction, setActiveAction] = React.useState<ClaimsAction>("claim");
  const [xpClaimAmount, setXPClaimAmount] = React.useState("");
  const [feeAmount, setFeeAmount] = React.useState("");

  const handleClaimXP = React.useCallback(async () => {
    if (!sdk?.account || readOnly) return;
    try {
      const parsed = parseDecimalToUnits(xpClaimAmount || "0", decimals);
      if (parsed <= 0n) {
        toast.error("Amount must be positive.");
        return;
      }
      if (!poolId) throw new Error("Pool unavailable");
      const result = await xpClaimFlow.execute(() =>
        sdk.bank.claimXPAccrued(poolId, parsed, sdk.account!)
      );
      if (!result.ok) return;
      toast.success(`Claimed ${formatUnits(parsed, decimals)} ${symbol}`);
      setXPClaimAmount("");
      await refetchXP();
    } catch (error) {
      toast.error((error as Error)?.message ?? "XP claim failed");
    }
  }, [decimals, poolId, readOnly, refetchXP, sdk, symbol, xpClaimAmount, xpClaimFlow]);

  const handleSyncHoldback = React.useCallback(async () => {
    if (!sdk?.account || readOnly) return;
    try {
      if (!poolId) throw new Error("Pool unavailable");
      const result = await syncHoldbackFlow.execute(() =>
        sdk.bank.syncXPHoldback(poolId, sdk.account!)
      );
      if (!result.ok) return;
      toast.success("Holdback synced");
      await refetchXP();
    } catch (error) {
      toast.error((error as Error)?.message ?? "Sync holdback failed");
    }
  }, [poolId, readOnly, refetchXP, sdk, syncHoldbackFlow]);

  const handleClaimFees = React.useCallback(async () => {
    if (!sdk?.account || readOnly) return;
    try {
      const parsed = parseDecimalToUnits(feeAmount || "0", decimals);
      if (parsed <= 0n) {
        toast.error("Amount must be positive.");
        return;
      }
      if (!poolId) throw new Error("Pool unavailable");
      const result = await protocolFeeFlow.execute(() =>
        sdk.bank.claimProtocolFees(poolId, parsed, sdk.account!)
      );
      if (!result.ok) return;
      toast.success(`Claimed ${formatUnits(parsed, decimals)} ${symbol} protocol fees`);
      setFeeAmount("");
      await refetchSnapshot();
    } catch (error) {
      toast.error((error as Error)?.message ?? "Protocol fee claim failed");
    }
  }, [decimals, feeAmount, poolId, protocolFeeFlow, readOnly, refetchSnapshot, sdk, symbol]);

  if (!release) {
    return (
      <Placeholder
        title="Claims"
        description={readOnlyReason ?? "No embedded release available."}
        specPath="docs/design/04-page-blueprints.md#7--portfolioclaims"
      />
    );
  }

  const metrics: ClaimsMetric[] = [
    {
      label: "Accrued",
      value: formatTokenAmount(xpBuckets?.accrued, decimals, symbol, 2),
      detail: "Ready for XP claim."
    },
    {
      label: "Holdback",
      value: formatTokenAmount(xpBuckets?.holdback, decimals, symbol, 2),
      detail: "Pending release buffer."
    },
    {
      label: "Protocol fees",
      value: formatTokenAmount(snapshot?.protocolFeesPayable, decimals, symbol, 2),
      detail: "Governance claim surface."
    }
  ];

  const activeFlow =
    activeAction === "claim"
      ? toFlowState(xpClaimFlow)
      : activeAction === "sync"
        ? toFlowState(syncHoldbackFlow)
        : toFlowState(protocolFeeFlow);

  const journalRows: ClaimsJournalRow[] = [
    ...toJournalRows({
      action: "Claim XP",
      amount: `${xpClaimAmount || formatTokenAmount(xpBuckets?.accrued, decimals, symbol, 2)}`,
      flow: toFlowState(xpClaimFlow)
    }),
    ...toJournalRows({
      action: "Sync holdback",
      amount: formatTokenAmount(xpBuckets?.holdback, decimals, symbol, 2),
      flow: toFlowState(syncHoldbackFlow)
    }),
    ...toJournalRows({
      action: "Claim fees",
      amount: `${feeAmount || formatTokenAmount(snapshot?.protocolFeesPayable, decimals, symbol, 2)}`,
      flow: toFlowState(protocolFeeFlow)
    })
  ];

  return (
    <PageTransition pageKey="claims">
      <div className="space-y-8">
        <ClaimsHero wallet={shortHex(sdk?.account)} metrics={metrics} />
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <ClaimsBuckets
              data={{ buckets: xpBuckets, snapshot }}
              decimals={decimals}
              symbol={symbol}
              loading={xpLoading}
              error={(xpError as Error | undefined)?.message}
            />
            <ClaimsJournal rows={journalRows} explorerBaseUrl={explorerBaseUrl} />
          </div>
          <ClaimsActionPanel
            action={activeAction}
            onActionChange={setActiveAction}
            xpAmount={xpClaimAmount}
            onXPAmountChange={setXPClaimAmount}
            feeAmount={feeAmount}
            onFeeAmountChange={setFeeAmount}
            symbol={symbol}
            decimals={decimals}
            claimable={xpBuckets?.accrued}
            feeClaimable={snapshot?.protocolFeesPayable}
            holdback={xpBuckets?.holdback}
            connected={Boolean(sdk?.account)}
            readOnly={readOnly}
            flow={activeFlow}
            explorerBaseUrl={explorerBaseUrl}
            onClaimXP={() => void handleClaimXP()}
            onSyncHoldback={() => void handleSyncHoldback()}
            onClaimFees={() => void handleClaimFees()}
          />
        </div>
      </div>
    </PageTransition>
  );
}

function toFlowState(flow: {
  status: TxStatus;
  steps: ClaimsFlowState["steps"];
  hasActivity: boolean;
  busy: boolean;
  error?: ClaimsFlowState["error"];
  txHash?: string;
  journalEntry?: { blockNumber?: number } | null;
  reset: () => void;
}): ClaimsFlowState {
  return {
    status: flow.status,
    steps: flow.steps,
    hasActivity: flow.hasActivity,
    busy: flow.busy,
    error: flow.error,
    txHash: flow.txHash,
    blockNumber: flow.journalEntry?.blockNumber,
    reset: flow.reset
  };
}

function toJournalRows({
  action,
  amount,
  flow
}: {
  action: string;
  amount: string;
  flow: ClaimsFlowState;
}): ClaimsJournalRow[] {
  if (!flow.txHash) return [];
  return [
    {
      key: flow.txHash,
      action,
      amount,
      status: flow.status,
      txHash: flow.txHash
    }
  ];
}

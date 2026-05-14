"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import { toast, type TxStatus } from "@ssot/ui";

import { PageTransition } from "../../components/PageTransition";
import { Placeholder } from "../../components/Placeholder";
import {
  getExplorerBaseUrl,
  isAddressLike,
  shortHex,
  ZERO_ADDRESS
} from "../../features/referral/format";
import { ReferralBindPanel } from "../../features/referral/referral-bind-panel";
import { ReferralHero } from "../../features/referral/referral-hero";
import { ReferralJournal, type ReferralJournalRow } from "../../features/referral/referral-journal";
import { ReferralNetwork } from "../../features/referral/referral-network";
import type { ReferralFlowState, ReferralMetric } from "../../features/referral/types";
import { useDirectTxAction } from "../../features/tx/useDirectTxAction";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";

export function ReferralPageClient() {
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const explorerBaseUrl = React.useMemo(() => getExplorerBaseUrl(chainId), [chainId]);
  const [referrerInput, setReferrerInput] = React.useState("");
  const [formError, setFormError] = React.useState<string | undefined>();
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const bindFlow = useDirectTxAction({
    action: "BIND_REFERRER",
    labels: {
      preflight: "Preflight",
      submit: "Submit bind",
      confirm: "Confirm on-chain"
    },
    descriptions: {
      preflight: "Validate referrer address.",
      submit: "Broadcast bindReferrer.",
      confirm: "Wait for receipt."
    }
  });

  const {
    data: currentReferrer = ZERO_ADDRESS,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ["ssot", "referral", "referrerOf", chainId, sdk?.account ?? "anonymous"],
    enabled: Boolean(sdk?.account && ready),
    queryFn: async () => {
      if (!sdk?.account) throw new Error("Wallet unavailable");
      return sdk.hub.referrerOf(sdk.account);
    },
    refetchInterval: 8_000
  });

  const flow = toFlowState(bindFlow);
  const hasBoundReferrer = currentReferrer.toLowerCase() !== ZERO_ADDRESS;
  const referralLink = sdk?.account && origin ? `${origin}/?ref=${sdk.account}` : undefined;

  const handleCopyLink = React.useCallback(() => {
    if (!referralLink) return;
    if (!navigator.clipboard?.writeText) {
      toast.error("Clipboard is unavailable in this browser.");
      return;
    }
    void navigator.clipboard
      .writeText(referralLink)
      .then(() => toast.success("Referral link copied"))
      .catch((copyError) =>
        toast.error((copyError as Error)?.message ?? "Failed to copy referral link")
      );
  }, [referralLink]);

  const handleBind = React.useCallback(async () => {
    if (!sdk?.account || readOnly) return;
    setFormError(undefined);

    const trimmed = referrerInput.trim();
    if (!isAddressLike(trimmed)) {
      setFormError("Enter a valid 0x address.");
      return;
    }
    if (trimmed.toLowerCase() === sdk.account.toLowerCase()) {
      setFormError("You cannot bind your own wallet.");
      return;
    }
    if (trimmed.toLowerCase() === ZERO_ADDRESS) {
      setFormError("Zero address cannot be a referrer.");
      return;
    }

    try {
      const result = await bindFlow.execute(() => sdk.hub.bindReferrer(trimmed as Address));
      if (!result.ok) return;
      toast.success("Referrer bound successfully");
      setReferrerInput("");
      await refetch();
    } catch (bindError) {
      toast.error((bindError as Error)?.message ?? "Referral bind failed");
    }
  }, [bindFlow, readOnly, refetch, referrerInput, sdk]);

  if (!release) {
    return (
      <Placeholder
        title="Referral"
        description={readOnlyReason ?? "No embedded release available."}
        specPath="docs/frontend/PAGE-SPECS/050-REFERRAL.md"
      />
    );
  }

  const metrics: ReferralMetric[] = [
    {
      label: "Bound referrer",
      value: hasBoundReferrer ? shortHex(currentReferrer) : "Unbound",
      detail: "Upstream address is immutable after a successful bind."
    },
    {
      label: "Invite link",
      value: referralLink ? "Ready" : "Wallet required",
      detail: "Generated from the connected wallet and current origin."
    },
    {
      label: "Release",
      value: shortHex(release.releaseDigest),
      detail: "Referral actions use the active frontend release manifest."
    }
  ];

  const journalRows: ReferralJournalRow[] = flow.txHash
    ? [
        {
          key: flow.txHash,
          action: "Bind referrer",
          value: shortHex(currentReferrer),
          status: flow.status,
          txHash: flow.txHash
        }
      ]
    : [];

  return (
    <PageTransition pageKey="referral">
      <div className="space-y-8">
        <ReferralHero wallet={shortHex(sdk?.account)} metrics={metrics} />

        {error ? (
          <div className="rounded-md border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
            {(error as Error)?.message ?? "Referral state unavailable."}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <ReferralNetwork hasBoundReferrer={hasBoundReferrer} loading={isLoading} />
            <ReferralJournal rows={journalRows} explorerBaseUrl={explorerBaseUrl} />
          </div>
          <ReferralBindPanel
            connected={Boolean(sdk?.account)}
            readOnly={readOnly}
            hasBoundReferrer={hasBoundReferrer}
            currentReferrer={currentReferrer}
            referralLink={referralLink}
            referrerInput={referrerInput}
            formError={formError}
            flow={flow}
            explorerBaseUrl={explorerBaseUrl}
            onReferrerInputChange={setReferrerInput}
            onBind={() => void handleBind()}
            onCopyLink={handleCopyLink}
          />
        </div>
      </div>
    </PageTransition>
  );
}

function toFlowState(flow: {
  status: TxStatus;
  steps: ReferralFlowState["steps"];
  hasActivity: boolean;
  busy: boolean;
  error?: ReferralFlowState["error"];
  txHash?: string;
  journalEntry?: { blockNumber?: number } | null;
  reset: () => void;
}): ReferralFlowState {
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

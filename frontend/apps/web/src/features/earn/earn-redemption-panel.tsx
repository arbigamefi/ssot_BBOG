import * as React from "react";
import { useTranslations } from "next-intl";
import type { DomainBankPosition, DomainBankSnapshot } from "@ssot/ssot";

import { parseDecimalToUnits, formatUnits } from "../betting/model/units";
import { formatTokenAmount } from "./format";
import { requestWalletConnect } from "../../app-shell/wallet-connect-events";

export type EarnRedemptionView = {
  walletShares: bigint;
  queuedShares: bigint;
  queuedLiquidAssets: bigint;
  queuedRecoveryAssets: bigint;
  cancellableShares: bigint;
  claimableShares: bigint;
  claimableAssets: bigint;
  /** Earliest eligibility of this controller's unactivated request. */
  eligibleAt: bigint[];
  paused: boolean;
};

export function getEarnRedemptionView(
  snapshot?: DomainBankSnapshot,
  position?: DomainBankPosition | null
): EarnRedemptionView | null {
  if (!snapshot || !position) return null;
  return {
    walletShares: position.shares,
    queuedShares: position.queuedShares,
    queuedLiquidAssets: position.queuedLiquidAssets,
    queuedRecoveryAssets: position.queuedRecoveryAssets,
    cancellableShares: position.cancellableShares,
    claimableShares: position.claimableShares,
    claimableAssets: position.claimableAssets,
    eligibleAt:
      position.queuedBatch && position.queuedShares > 0n ? [position.queuedBatch.cutoff] : [],
    paused: snapshot.riskInPaused
  };
}

function formatEligibility(timestamp: bigint) {
  const date = new Date(Number(timestamp) * 1000);
  return Number.isNaN(date.getTime())
    ? timestamp.toString()
    : date.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

export function EarnRedemptionPanel({
  state,
  connected,
  decimals,
  symbol,
  disabled,
  busy,
  onRequest,
  onCancel,
  onClaim,
  receiver
}: {
  state: EarnRedemptionView | null;
  connected: boolean;
  decimals: number;
  symbol: string;
  disabled: boolean;
  busy: boolean;
  onRequest: (shares: bigint) => void;
  onCancel: () => void;
  onClaim: () => void;
  receiver?: string;
}) {
  const t = useTranslations();
  const [amount, setAmount] = React.useState("");
  React.useEffect(() => setAmount(""), [state?.walletShares]);
  let shares: bigint | null = null;
  try {
    shares = parseDecimalToUnits(amount, decimals);
  } catch {
    // Keep invalid amounts editable without enabling a wallet operation.
  }
  if (!state)
    return (
      <div>
        <p role="status" className="text-sm text-fg-muted">
          {t(connected ? "earn.async.unknown" : "earn.actions.connectWallet")}
        </p>
        {!connected ? (
          <button
            type="button"
            className="mt-3 min-h-11 rounded-md bg-brand px-4 font-bold text-fg-inverse"
            onClick={requestWalletConnect}
          >
            {t("app.connectWalletButton")}
          </button>
        ) : null}
      </div>
    );
  const canRequest = shares != null && shares > 0n && shares <= state.walletShares;
  const buttonClass =
    "min-h-11 rounded-md border border-border px-4 py-3 text-sm font-bold text-fg transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-4" aria-label={t("earn.async.title")}>
      <p className="text-sm leading-6 text-fg-muted">{t("earn.async.requestDetail")}</p>
      {state.paused ? (
        <p role="status" className="text-sm text-warn">
          {t("earn.async.paused")}
        </p>
      ) : null}
      <div className="rounded-md border border-border bg-surface-0 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <label htmlFor="earn-request-shares" className="font-bold text-fg">
            {t("earn.async.requestAmount")}
          </label>
          <button
            type="button"
            className="min-h-11 px-2 text-brand disabled:opacity-50"
            disabled={disabled || busy || state.walletShares === 0n}
            onClick={() => setAmount(formatUnits(state.walletShares, decimals))}
          >
            {t("earn.actions.balance.useMax")}
          </button>
        </div>
        <p className="mb-2 text-xs text-fg-muted">
          {t("earn.async.wallet", {
            amount: formatTokenAmount(state.walletShares, decimals, undefined, 6)
          })}
        </p>
        <input
          id="earn-request-shares"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={disabled || busy}
          aria-describedby="earn-request-risk"
          className="min-h-11 w-full rounded border border-border bg-surface-1 px-3 font-mono text-xl text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          placeholder="0"
        />
        <p id="earn-request-risk" className="mt-2 text-xs leading-5 text-fg-muted">
          {t("earn.async.pendingRisk")}
        </p>
        <button
          type="button"
          disabled={disabled || busy || !canRequest}
          className={`${buttonClass} mt-3 w-full bg-brand text-fg-inverse`}
          onClick={() => {
            if (canRequest && shares != null) onRequest(shares);
          }}
        >
          {t(busy ? "earn.actions.submit.executing" : "earn.async.request")}
        </button>
      </div>
      <section className="rounded-md border border-border p-4" aria-labelledby="earn-queued-title">
        <h3 id="earn-queued-title" className="font-bold text-fg">
          {t("earn.async.queuedTitle")}
        </h3>
        <p className="mt-2 font-mono text-fg">
          {formatTokenAmount(state.queuedShares, decimals, t("earn.units.sharesLower"), 6)}
          {" / "}
          {formatTokenAmount(state.queuedLiquidAssets, decimals, symbol, 6)}
        </p>
        <p className="mt-2 text-xs leading-5 text-fg-muted">{t("earn.async.queuedQuoteDetail")}</p>
        <p className="mt-2 text-sm text-fg">
          {t("earn.recovery.upperBound")}:{" "}
          {formatTokenAmount(state.queuedRecoveryAssets, decimals, symbol, 6)}
        </p>
        <p className="mt-1 text-xs leading-5 text-fg-muted">
          {t("earn.recovery.upperBoundDetail")}
        </p>
        <p role="status" className="mt-2 text-sm leading-6 text-fg-muted">
          {t("earn.async.queuedDetail")}
        </p>
        {state.eligibleAt.map((timestamp) => (
          <p key={timestamp.toString()} className="mt-1 text-xs text-fg-muted">
            {t("earn.async.eligibleAt", { time: formatEligibility(timestamp) })}
          </p>
        ))}
        <p className="mt-2 text-xs leading-5 text-fg-muted">{t("earn.async.cancelDetail")}</p>
        <button
          type="button"
          className={`${buttonClass} mt-3 w-full`}
          disabled={disabled || busy || state.cancellableShares === 0n}
          onClick={onCancel}
        >
          {t("earn.async.cancel")}
        </button>
      </section>
      <section className="rounded-md border border-border p-4" aria-labelledby="earn-claim-title">
        <h3 id="earn-claim-title" className="font-bold text-fg">
          {t("earn.async.claimableTitle")}
        </h3>
        <p className="mt-2 font-mono text-fg">
          {formatTokenAmount(state.claimableAssets, decimals, symbol, 6)}
        </p>
        <p className="mt-2 text-xs leading-5 text-fg-muted">{t("earn.async.claimDetail")}</p>
        {receiver ? (
          <p className="mt-2 break-all text-xs text-fg-muted">
            {t("earn.async.receiver", { receiver })}
          </p>
        ) : null}
        <button
          type="button"
          className={`${buttonClass} mt-3 w-full`}
          disabled={disabled || busy || state.paused || state.claimableShares === 0n}
          onClick={onClaim}
        >
          {t(
            state.claimableShares > 0n && state.claimableAssets === 0n
              ? "earn.async.clearZero"
              : "earn.async.claimAll"
          )}
        </button>
      </section>
    </div>
  );
}

export function EarnPlayerPayable({
  amount,
  decimals,
  symbol,
  disabled,
  onClaim
}: {
  amount: bigint;
  decimals: number;
  symbol: string;
  disabled: boolean;
  onClaim: () => void;
}) {
  const t = useTranslations();
  if (amount === 0n) return null;
  return (
    <section
      aria-labelledby="earn-player-payable"
      className="mt-4 rounded-md border border-border bg-surface-1 p-4"
    >
      <h2 id="earn-player-payable" className="font-bold text-fg">
        {t("earn.async.playerTitle")}
      </h2>
      <p className="mt-2 font-mono text-fg">{formatTokenAmount(amount, decimals, symbol, 6)}</p>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{t("earn.async.playerDetail")}</p>
      <button
        type="button"
        className="mt-3 min-h-11 rounded-md bg-brand px-4 py-3 font-bold text-fg-inverse disabled:opacity-50"
        disabled={disabled}
        onClick={onClaim}
      >
        {t("earn.async.claimPlayer")}
      </button>
    </section>
  );
}

export function EarnDepositNotice({
  loaded,
  inactive,
  paused,
  busy,
  onRefresh
}: {
  loaded: boolean;
  inactive: boolean;
  paused: boolean;
  busy: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-2 text-sm leading-6 text-fg-muted">
      {!loaded ? (
        <p role="status">{t("earn.async.unknown")}</p>
      ) : (
        <>
          <p>{t(inactive ? "earn.async.inactivePool" : "earn.async.depositTerms")}</p>
          <p>{t("earn.async.issuerRisk")}</p>
          {paused ? (
            <p role="status" className="text-warn">
              {t("earn.async.paused")}
            </p>
          ) : null}
        </>
      )}
      <button type="button" className="min-h-11 text-brand" disabled={busy} onClick={onRefresh}>
        {t("earn.async.refresh")}
      </button>
    </div>
  );
}

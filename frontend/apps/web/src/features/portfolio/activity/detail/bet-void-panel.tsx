"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { DomainBet } from "@ssot/ssot";
import { toast } from "@ssot/ui";

import { requestWalletConnect } from "../../../../app-shell/wallet-connect-events";
import { formatLocalDateTime } from "../../../../i18n/format";
import { useRelease } from "../../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../../ssot/sdk";
import { txErrorMessage } from "../../../tx/tx-error-copy";
import { PlayerPayableClaim } from "../../claims/player-payable-claim";
import { formatTokenAmount } from "./format";

/**
 * Void eligibility of an open bet. A received result that is not booked can no longer take the
 * timeout refund (GameHub.refund reverts); it settles or voids (ADR-0037 §7).
 */
export function useBetVoidStatus(bet: DomainBet | null | undefined) {
  const { sdk } = useSSOTSDK();
  const open = bet?.state === "placed" || bet?.state === "randomReady";
  return useQuery({
    queryKey: ["ssot", "voidStatus", sdk?.release.chainId, bet?.betId.toString()],
    enabled: Boolean(sdk && bet && open),
    queryFn: () => sdk!.gameHub.getVoidStatus(bet!.betId),
    refetchInterval: 30_000
  });
}

/**
 * ADR-0037 §7. A voided bet explains where the stake went and offers the claim. A bet whose result
 * was received but not settled shows when it becomes voidable and, once eligible, the void action.
 */
export function BetVoidPanel({
  bet,
  chainId,
  symbol,
  decimals,
  onVoidSent
}: {
  bet: DomainBet | null | undefined;
  chainId: number;
  symbol: string;
  decimals: number;
  onVoidSent: () => void;
}) {
  const t = useTranslations();
  const { release } = useRelease();
  const poolId = React.useMemo(
    () =>
      bet
        ? release?.pools?.find((pool) => pool.bank.toLowerCase() === bet.bank.toLowerCase())?.poolId
        : undefined,
    [bet, release?.pools]
  );

  if (!bet) return null;
  if (bet.state === "voided") {
    return (
      <section
        className="rounded-md border border-border bg-surface-1 p-5 shadow-e2"
        data-testid="bet-voided"
      >
        <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
          {t("portfolio.activity.detail.void.eyebrow")}
        </div>
        <h2 className="mt-2 text-2xl font-black text-fg">
          {t("portfolio.activity.detail.void.voidedTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">
          {t("portfolio.activity.detail.void.voidedBody")}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-border-soft bg-surface-0 px-4 py-3">
          <span className="text-sm text-fg-muted">
            {t("portfolio.activity.detail.void.returnedStake")}
          </span>
          <span className="font-mono text-sm font-bold text-fg">
            {formatTokenAmount(bet.stake, decimals, symbol, 6)}
          </span>
        </div>
        {poolId != null ? (
          <div className="mt-4">
            <PlayerPayableClaim
              chainId={chainId}
              poolId={poolId}
              player={bet.player}
              symbol={symbol}
              decimals={decimals}
            />
          </div>
        ) : null}
      </section>
    );
  }
  if (bet.state !== "placed" && bet.state !== "randomReady") return null;
  return <StuckBetVoid bet={bet} onVoidSent={onVoidSent} />;
}

function StuckBetVoid({ bet, onVoidSent }: { bet: DomainBet; onVoidSent: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const { sdk } = useSSOTSDK();
  const { readOnly } = useRelease();
  const [voiding, setVoiding] = React.useState(false);
  const inFlight = React.useRef(false);
  const status = useBetVoidStatus(bet);
  const voidStatus = status.data;
  // An undelivered request takes the timeout refund instead; only a received, unbooked result voids.
  if (!voidStatus?.resultReceived) return null;

  const connected = Boolean(sdk?.account);
  const runVoid = async () => {
    if (!sdk || inFlight.current) return;
    inFlight.current = true;
    setVoiding(true);
    try {
      const result = await sdk.gameHub.voidBet(bet.betId);
      if (!result.ok) {
        toast.error(txErrorMessage(t, result.error));
        return;
      }
      toast.success(
        t(
          result.outcome === "settled"
            ? "portfolio.activity.detail.void.toast.settled"
            : result.outcome === "voided"
              ? "portfolio.activity.detail.void.toast.voided"
              : "portfolio.activity.detail.void.toast.sent"
        )
      );
      onVoidSent();
    } catch {
      toast.error(t("app.txErrors.unknown"));
    } finally {
      inFlight.current = false;
      setVoiding(false);
      void status.refetch();
    }
  };

  return (
    <section
      className="rounded-md border border-warn/30 bg-surface-1 p-5 shadow-e2"
      data-testid="bet-void-status"
    >
      <div className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
        {t("portfolio.activity.detail.void.eyebrow")}
      </div>
      <h2 className="mt-2 text-2xl font-black text-fg">
        {t("portfolio.activity.detail.void.stuckTitle")}
      </h2>
      {voidStatus.voidable ? (
        <>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            {t("portfolio.activity.detail.void.eligible")}
          </p>
          <button
            type="button"
            disabled={voiding || (connected && readOnly)}
            onClick={() => (connected ? void runVoid() : requestWalletConnect())}
            className="mt-4 min-h-11 w-full rounded-md bg-brand px-4 py-3 text-sm font-black text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {!connected
              ? t("portfolio.activity.detail.void.connect")
              : voiding
                ? t("portfolio.activity.detail.void.voiding")
                : t("portfolio.activity.detail.void.action")}
          </button>
          <p className="mt-3 text-xs leading-5 text-fg-muted">
            {t("portfolio.activity.detail.void.keeperNote")}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm leading-6 text-fg-muted">
          {t("portfolio.activity.detail.void.notYet", {
            time: formatLocalDateTime(voidStatus.eligibleAt, locale)
          })}
        </p>
      )}
    </section>
  );
}

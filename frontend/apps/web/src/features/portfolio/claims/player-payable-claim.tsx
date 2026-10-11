"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import { toast } from "@ssot/ui";

import { requestWalletConnect } from "../../../app-shell/wallet-connect-events";
import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";
import { txErrorMessage } from "../../tx/tx-error-copy";
import { formatTokenAmount } from "./format";

export const PLAYER_PAYABLE_QUERY_KEY = ["ssot", "playerPayable"] as const;

/**
 * One pool's player payable: stakes returned by voids and payouts that could not be transferred at
 * settlement. `claimPlayerPayable` always pays the player, so any connected wallet may send it.
 */
export function usePlayerPayable({
  chainId,
  poolId,
  player
}: {
  chainId: number;
  poolId: number | undefined;
  player: Address | undefined;
}) {
  const { sdk } = useSSOTSDK();
  const sameChain = sdk?.release.chainId === chainId;
  return useQuery({
    queryKey: [...PLAYER_PAYABLE_QUERY_KEY, chainId, poolId, player?.toLowerCase()],
    enabled: Boolean(sdk && sameChain && poolId != null && player),
    queryFn: () => sdk!.bank.getPlayerPayable(poolId!, player!),
    refetchInterval: 20_000
  });
}

export function useClaimPlayerPayable({
  chainId,
  poolId,
  player,
  amountLabel
}: {
  chainId: number;
  poolId: number | undefined;
  player: Address | undefined;
  amountLabel: string;
}) {
  const t = useTranslations();
  const { sdk } = useSSOTSDK();
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = React.useState(false);
  const inFlight = React.useRef(false);
  const claim = React.useCallback(async () => {
    if (!sdk || poolId == null || !player || inFlight.current) return;
    inFlight.current = true;
    setClaiming(true);
    try {
      const result = await sdk.bank.claimPlayerPayable(poolId, player);
      if (!result.ok) {
        toast.error(txErrorMessage(t, result.error));
        return;
      }
      toast.success(t("portfolio.claims.payable.claimed", { amount: amountLabel }));
    } catch {
      toast.error(t("app.txErrors.unknown"));
    } finally {
      inFlight.current = false;
      setClaiming(false);
      await queryClient.invalidateQueries({ queryKey: [...PLAYER_PAYABLE_QUERY_KEY, chainId] });
    }
  }, [amountLabel, chainId, player, poolId, queryClient, sdk, t]);
  return { claim, claiming };
}

/** The claim block shown on a voided bet's receipt and activity detail. */
export function PlayerPayableClaim({
  chainId,
  poolId,
  player,
  symbol,
  decimals
}: {
  chainId: number;
  poolId: number;
  player: Address;
  symbol: string;
  decimals: number;
}) {
  const t = useTranslations();
  const { sdk } = useSSOTSDK();
  const { readOnly } = useRelease();
  const payable = usePlayerPayable({ chainId, poolId, player });
  const amount = payable.data;
  const amountLabel = formatTokenAmount(amount, decimals, symbol, 6);
  const { claim, claiming } = useClaimPlayerPayable({ chainId, poolId, player, amountLabel });

  if (sdk && sdk.release.chainId !== chainId) {
    return (
      <Link
        href={`/portfolio/claims?chainId=${chainId}`}
        className="inline-flex min-h-11 items-center text-sm font-bold text-brand hover:text-brand-hover"
      >
        {t("portfolio.claims.payable.openClaims")}
      </Link>
    );
  }
  if (payable.error) {
    return (
      <p role="alert" className="text-sm text-warn">
        {t("portfolio.claims.payable.unavailable")}
      </p>
    );
  }
  if (amount == null) return null;
  if (amount === 0n) {
    return (
      <p className="text-sm leading-6 text-fg-muted">{t("portfolio.claims.payable.nothing")}</p>
    );
  }
  const connected = Boolean(sdk?.account);
  return (
    <div className="space-y-2" data-testid="player-payable-claim">
      <p className="text-sm text-fg">
        {t("portfolio.claims.payable.claimable", { amount: amountLabel })}
      </p>
      <button
        type="button"
        disabled={claiming || (connected && readOnly)}
        onClick={() => (connected ? void claim() : requestWalletConnect())}
        className="min-h-11 w-full rounded-md border border-brand/40 bg-brand px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-fg-inverse shadow-e1 transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!connected
          ? t("portfolio.claims.payable.connect")
          : claiming
            ? t("portfolio.claims.payable.claiming")
            : t("portfolio.claims.payable.claim", { amount: amountLabel })}
      </button>
      <p className="text-xs leading-5 text-fg-muted">{t("portfolio.claims.payable.note")}</p>
    </div>
  );
}

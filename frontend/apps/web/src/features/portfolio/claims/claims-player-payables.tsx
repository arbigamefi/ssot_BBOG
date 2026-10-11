"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useQueries } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import { BanknotesIcon } from "@heroicons/react/24/outline";

import { useRelease } from "../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../ssot/sdk";
import { formatTokenAmount } from "./format";
import { PLAYER_PAYABLE_QUERY_KEY, useClaimPlayerPayable } from "./player-payable-claim";

type PayablePool = { poolId: number; symbol: string; decimals: number };

/**
 * What every release pool owes the connected wallet as a player: stakes returned by voids and payouts
 * that could not be transferred at settlement. Inactive pools are listed too: a stopped pool still
 * pays its debts, and a claim works while a pool is paused (ADR-0037 §4).
 */
export function ClaimsPlayerPayables() {
  const t = useTranslations("portfolio.claims.player");
  const { release, chainId } = useRelease();
  const { sdk } = useSSOTSDK();
  const account = sdk?.account;
  const pools = React.useMemo<PayablePool[]>(
    () =>
      (release?.pools ?? []).map((pool) => {
        const asset = release?.assets.find(
          (item) => item.address.toLowerCase() === pool.asset.toLowerCase()
        );
        return {
          poolId: pool.poolId,
          symbol: pool.symbol ?? asset?.symbol ?? "",
          decimals: pool.decimals ?? asset?.decimals ?? 18
        };
      }),
    [release?.assets, release?.pools]
  );
  const reads = useQueries({
    queries: pools.map((pool) => ({
      queryKey: [...PLAYER_PAYABLE_QUERY_KEY, chainId, pool.poolId, account?.toLowerCase()],
      enabled: Boolean(sdk && account && sdk.release.chainId === chainId),
      queryFn: () => sdk!.bank.getPlayerPayable(pool.poolId, account!),
      refetchInterval: 20_000
    }))
  });
  const owed = pools.flatMap((pool, index) => {
    const amount = reads[index]?.data;
    return amount != null && amount > 0n ? [{ pool, amount }] : [];
  });
  const failed = pools.filter((_, index) => reads[index]?.error);
  const settled = reads.every((read) => read.data != null || read.error);

  return (
    <section
      className="rounded-md border border-border bg-surface-1 shadow-e2"
      aria-labelledby="claims-player-title"
      data-testid="claims-player-payables"
    >
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
          <BanknotesIcon className="h-4 w-4 text-brand" />
          {t("eyebrow")}
        </div>
        <h2 id="claims-player-title" className="mt-2 text-2xl font-black text-fg">
          {t("title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-fg-muted">{t("description")}</p>
      </div>
      <div className="grid gap-3 p-5">
        {!account ? (
          <p className="text-sm text-fg-muted">{t("connect")}</p>
        ) : (
          <>
            {owed.map(({ pool, amount }) => (
              <PayableRow
                key={pool.poolId}
                chainId={chainId}
                pool={pool}
                amount={amount}
                player={account}
              />
            ))}
            {failed.map((pool) => (
              <p key={pool.poolId} role="alert" className="text-sm text-warn">
                {t("unavailable", { symbol: pool.symbol, poolId: pool.poolId })}
              </p>
            ))}
            {owed.length === 0 && failed.length === 0 ? (
              <p className="text-sm text-fg-muted">{settled ? t("empty") : t("checking")}</p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function PayableRow({
  chainId,
  pool,
  amount,
  player
}: {
  chainId: number;
  pool: PayablePool;
  amount: bigint;
  player: Address;
}) {
  const t = useTranslations("portfolio.claims");
  const { readOnly } = useRelease();
  const amountLabel = formatTokenAmount(amount, pool.decimals, pool.symbol, 6);
  const { claim, claiming } = useClaimPlayerPayable({
    chainId,
    poolId: pool.poolId,
    player,
    amountLabel
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-soft bg-surface-0 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle">
          {t("player.pool", { symbol: pool.symbol, poolId: pool.poolId })}
        </div>
        <div className="mt-1 font-mono text-lg font-black text-fg">{amountLabel}</div>
      </div>
      <button
        type="button"
        disabled={claiming || readOnly}
        onClick={() => void claim()}
        className="min-h-11 rounded-md bg-brand px-4 text-xs font-black uppercase tracking-[0.12em] text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {claiming ? t("payable.claiming") : t("player.claim")}
      </button>
    </div>
  );
}

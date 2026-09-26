import type { DomainBankSnapshot } from "@ssot/ssot";

import { formatHoldPercent, formatMultiple, formatTokenAmount } from "./format";
import type { EarnMetric } from "./types";

type Translate = (key: string) => string;

/**
 * Headline figures for the Pools hero, all read from the Bank on-chain.
 *
 * Hold is gross gaming revenue (turnover minus gross payouts) over turnover. It
 * is not LP profit: the share price is what reflects LP results, after payout
 * fees kept by the pool and the protocol fees and referral rewards accrued
 * against it.
 */
export function buildEarnHeroMetrics({
  snapshot,
  decimals,
  symbol,
  t
}: {
  snapshot: DomainBankSnapshot | undefined;
  decimals: number;
  symbol: string;
  t: Translate;
}): EarnMetric[] {
  const grossGamingRevenue =
    snapshot?.totalTurnover != null && snapshot.totalPayoutGross != null
      ? snapshot.totalTurnover - snapshot.totalPayoutGross
      : undefined;
  const realizedHold =
    grossGamingRevenue != null && snapshot?.totalTurnover != null
      ? formatHoldPercent(grossGamingRevenue, snapshot.totalTurnover)
      : null;
  const capitalVelocity =
    snapshot?.totalTurnover != null
      ? formatMultiple(snapshot.totalTurnover, snapshot.totalAssets)
      : null;

  return [
    {
      label: t("earn.metrics.sharePrice.label"),
      value: formatTokenAmount(
        snapshot?.assetsPerShare != null ? snapshot.assetsPerShare * 1000n : undefined,
        decimals,
        symbol,
        4
      ),
      detail: t("earn.metrics.sharePrice.detail")
    },
    {
      label: t("earn.metrics.totalShares.label"),
      value: formatTokenAmount(snapshot?.totalSupply, decimals, undefined, 2),
      detail: t("earn.metrics.totalShares.detail")
    },
    {
      label: t("earn.performance.velocity"),
      value: capitalVelocity ?? "—",
      detail: t("earn.performance.onChain")
    },
    {
      label: t("earn.performance.hold"),
      value: realizedHold ?? "—",
      detail: t("earn.performance.onChain")
    }
  ];
}

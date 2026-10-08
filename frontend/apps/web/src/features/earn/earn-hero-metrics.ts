import type { DomainBankSnapshot } from "@ssot/ssot";
import { formatHoldPercent, formatTokenAmount } from "./format";
import type { EarnMetric } from "./types";

export function buildEarnHeroMetrics({
  snapshot,
  decimals,
  symbol,
  t
}: {
  snapshot: DomainBankSnapshot | undefined;
  decimals: number;
  symbol: string;
  t: (key: string) => string;
}): EarnMetric[] {
  const hold =
    snapshot?.totalTurnover != null && snapshot.totalPayoutGross != null
      ? formatHoldPercent(
          snapshot.totalTurnover - snapshot.totalPayoutGross,
          snapshot.totalTurnover
        )
      : null;
  return [
    {
      label: t("earn.nft.poolCapital"),
      value: formatTokenAmount(snapshot?.L, decimals, symbol, 4),
      detail: t("earn.nft.poolCapitalDetail")
    },
    {
      label: t("earn.nft.freeCapital"),
      value: formatTokenAmount(snapshot?.lpFreeCapital, decimals, symbol, 4),
      detail: t("earn.nft.freeCapitalDetail")
    },
    {
      label: t("earn.nft.lockedCapital"),
      value: formatTokenAmount(snapshot?.K, decimals, symbol, 4),
      detail: t("earn.nft.lockedCapitalDetail")
    },
    { label: t("earn.performance.hold"), value: hold ?? "—", detail: t("earn.nft.gameHoldDetail") }
  ];
}

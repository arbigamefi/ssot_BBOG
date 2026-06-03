"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import type { GameMeta } from "../../../../features/casino/room/model";

function AuditLedgerLoading() {
  const t = useTranslations();

  return (
    <div className="rounded-lg border border-border bg-surface-1 p-6 text-sm font-bold uppercase tracking-[0.18em] text-fg-subtle">
      {t("casino.room.audit.loading")}
    </div>
  );
}

export function getLocalizedGameName(t: (key: string) => string, game: GameMeta) {
  switch (game.slug) {
    case "dice":
      return t("casino.room.names.dice");
    case "roulette":
      return t("casino.room.names.roulette");
    case "coin-toss":
      return t("casino.room.names.coinToss");
    case "keno":
      return t("casino.room.names.keno");
    case "plinko":
      return t("casino.room.names.plinko");
    case "slots":
      return t("casino.room.names.slots");
    case "baccarat":
      return t("casino.room.names.baccarat");
    case "sic-bo":
      return t("casino.room.names.sicBo");
    default:
      return game.label;
  }
}

export const GameRoomAuditLedger = dynamic(
  () =>
    import("../../../../features/casino/room/audit-ledger").then((mod) => mod.GameRoomAuditLedger),
  {
    loading: () => <AuditLedgerLoading />,
    ssr: false
  }
);

export function getCasinoRoomPendingStates({
  isLocalPending,
  isTransactionActive,
  isOutcomeTracking,
  hasStageReveal,
  hasCasinoOutcome,
  isResultVisible = false
}: {
  isLocalPending: boolean;
  isTransactionActive: boolean;
  isOutcomeTracking: boolean;
  hasStageReveal: boolean;
  hasCasinoOutcome: boolean;
  isResultVisible?: boolean;
}) {
  const isRoundInputLocked =
    isLocalPending || isTransactionActive || isOutcomeTracking || hasStageReveal || isResultVisible;

  return {
    isBetPanelPending: isRoundInputLocked,
    isStagePending: isOutcomeTracking && !hasStageReveal && !hasCasinoOutcome
  };
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * Bets whose VRF result arrived but never settled (ADR-0037 §7). Each waits for settlement or a void
 * on its own page; the notice never blocks the next bet, and no refund is offered for them.
 */
export function PendingSettlementNotice({ betIds }: { betIds: readonly bigint[] }) {
  const t = useTranslations();
  if (betIds.length === 0) return null;
  return (
    <div
      role="status"
      data-testid="pending-settlement-notice"
      className="mb-2 grid gap-1 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs leading-5 text-fg"
    >
      {betIds.map((betId) => (
        <p key={betId.toString()}>
          {t("casino.room.roundStatus.pendingSettlement.notice", { betId: betId.toString() })}{" "}
          <Link
            href={`/portfolio/activity/${betId.toString()}`}
            className="font-bold text-brand hover:text-brand-hover"
          >
            {t("casino.room.roundStatus.pendingSettlement.link")}
          </Link>
        </p>
      ))}
    </div>
  );
}

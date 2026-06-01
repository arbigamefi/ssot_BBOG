import * as React from "react";
import { useTranslations } from "next-intl";

import type { GameMeta } from "./model";
import { PlaceBetButton } from "./place-bet-button";

export function MobileCasinoActionBar({
  game,
  betAmount,
  hasAccount,
  isPending,
  winChance,
  state,
  onPlaceBet
}: {
  game: GameMeta;
  betAmount: number;
  hasAccount: boolean;
  isPending: boolean;
  winChance: number;
  state: React.ComponentProps<typeof PlaceBetButton>["state"];
  onPlaceBet: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(9rem,44%)] items-center gap-3">
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          {t("casino.room.betPanel.amount.label")}
        </p>
        <p className="truncate font-mono text-base font-semibold text-fg">
          {betAmount.toFixed(2)} USDC
        </p>
      </div>
      <PlaceBetButton
        gameSlug={game.slug}
        hasAccount={hasAccount}
        isPending={isPending}
        winChance={winChance}
        state={state}
        onClick={onPlaceBet}
        density="compact"
      />
    </div>
  );
}

import * as React from "react";
import { useTranslations } from "next-intl";
import type { DomainSportsMarket } from "@ssot/ssot";
import { cn } from "@ssot/ui";

import type { MarketWallClock } from "./player-format";

type SportsMarketState = DomainSportsMarket["state"];

type Tone = "live" | "open" | "pending" | "settled" | "void" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  live: "bg-danger-soft text-danger ring-1 ring-inset ring-danger/35",
  open: "bg-brand-soft text-brand ring-1 ring-inset ring-brand/30",
  pending: "bg-warn-soft text-warn ring-1 ring-inset ring-warn/30",
  settled: "bg-success-soft text-success ring-1 ring-inset ring-success/30",
  void: "bg-surface-3 text-fg-subtle ring-1 ring-inset ring-border",
  neutral: "bg-surface-2 text-fg-muted ring-1 ring-inset ring-border"
};

function stateTone(state: SportsMarketState, clock?: MarketWallClock): Tone {
  if (clock?.kind === "live") return "live";
  switch (state) {
    case "open":
      return "open";
    case "draft":
      return "neutral";
    case "locked":
    case "suspended":
    case "resultProposed":
    case "challenged":
      return "pending";
    case "resolved":
      return "settled";
    case "voided":
      return "void";
    case "none":
    default:
      return "neutral";
  }
}

/**
 * MarketStateBadge — compact pill that conveys both lifecycle state and
 * wall-clock urgency in one glance. The pill text comes from i18n; the colour
 * comes from the state→tone map. Use the small variant on dense lists and the
 * default variant on detail headers.
 */
export function MarketStateBadge({
  state,
  clock,
  size = "default",
  className
}: {
  state: SportsMarketState;
  clock?: MarketWallClock;
  size?: "small" | "default";
  className?: string;
}) {
  const t = useTranslations("sportsbook.player.marketState");
  const tone = stateTone(state, clock);
  const label = clock?.kind === "live" ? t("live") : t(state);
  const dimensions =
    size === "small"
      ? "h-5 px-2 text-[10px] tracking-[0.14em]"
      : "h-6 px-2.5 text-[11px] tracking-[0.16em]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold uppercase",
        dimensions,
        TONE_CLASS[tone],
        className
      )}
    >
      {clock?.kind === "live" ? (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger" />
      ) : null}
      {label}
    </span>
  );
}

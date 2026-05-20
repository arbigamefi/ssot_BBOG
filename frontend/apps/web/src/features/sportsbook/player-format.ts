/**
 * Player-facing sportsbook formatters.
 *
 * Distinct from `format.ts` (which serves the ops/inspector layer):
 * - relative time (live in 5m / starts at 7:30 PM)
 * - kickoff weekday + clock
 * - event identity heuristics when provider metadata is missing
 *
 * Returned strings are i18n-neutral when locale is omitted (English fallback);
 * pass a locale string to render with the user locale.
 */

import type { DomainSportsMarket } from "@ssot/ssot";

export type MarketWallClockKind = "live" | "soon" | "scheduled" | "past" | "unknown";

export interface MarketWallClock {
  kind: MarketWallClockKind;
  /** Short pill label ("LIVE", "3m", "Sat 7:30 PM", "Past"). */
  label: string;
  /** Long absolute label suitable for tooltip and detail page. */
  absolute: string;
  /** Milliseconds remaining until kickoff (negative if past). undefined if unknown. */
  msRemaining?: number;
}

const SHORT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit"
};

const ABSOLUTE_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short"
};

const ABSOLUTE_UTC_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC"
};

function safeDate(seconds: bigint | number | undefined): Date | undefined {
  if (seconds === undefined || seconds === null) return undefined;
  const ms = typeof seconds === "bigint" ? Number(seconds) * 1000 : seconds * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return new Date(ms);
}

function fmt(date: Date, locale: string | undefined, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(locale ?? "en", options).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Compute the player-facing wall-clock summary for a market.
 *
 * Rules:
 * - if startsAt unknown   → "unknown"
 * - if startsAt in past   → "past" (state Resolved/Voided uses "past" too)
 * - if startsAt < 15min   → "live"   ("LIVE" pill)
 * - if startsAt < 2h      → "soon"   ("12m", "1h 5m")
 * - else                  → "scheduled" ("Sat 7:30 PM")
 */
export function describeMarketWallClock(
  market: Pick<DomainSportsMarket, "startsAt" | "state">,
  now: number = Date.now(),
  locale?: string
): MarketWallClock {
  const startsAtDate = safeDate(market.startsAt);
  if (!startsAtDate) {
    return { kind: "unknown", label: "—", absolute: "—" };
  }
  const absolute = fmt(startsAtDate, locale, ABSOLUTE_DATE_FORMAT);
  const msRemaining = startsAtDate.getTime() - now;

  if (market.state === "resolved" || market.state === "voided") {
    return { kind: "past", label: "Past", absolute, msRemaining };
  }

  if (msRemaining <= 15 * 60 * 1000 && msRemaining > -3 * 60 * 60 * 1000) {
    return { kind: "live", label: "LIVE", absolute, msRemaining };
  }

  if (msRemaining < 0) {
    return { kind: "past", label: "Past", absolute, msRemaining };
  }

  if (msRemaining <= 2 * 60 * 60 * 1000) {
    const totalMinutes = Math.max(1, Math.round(msRemaining / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    return { kind: "soon", label, absolute, msRemaining };
  }

  const label = fmt(startsAtDate, locale, SHORT_DATE_FORMAT);
  return { kind: "scheduled", label, absolute, msRemaining };
}

export type SportsMarketBucket = "live" | "today" | "upcoming" | "past";

export function bucketMarket(clock: MarketWallClock, now: number = Date.now()): SportsMarketBucket {
  if (clock.kind === "live") return "live";
  if (clock.kind === "past") return "past";
  if (clock.kind === "unknown") return "upcoming";
  if (typeof clock.msRemaining !== "number") return "upcoming";
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (now + clock.msRemaining <= endOfToday.getTime()) return "today";
  return "upcoming";
}

/**
 * Last 4 hex chars of marketKey, suitable for inline mention.
 * Hex addresses look noisy; players see a short tag instead of the full hash.
 */
export function marketShortTag(marketKey: string | undefined): string {
  if (!marketKey || typeof marketKey !== "string") return "—";
  const trimmed = marketKey.replace(/^0x/, "");
  if (trimmed.length <= 6) return marketKey;
  return trimmed.slice(-6).toUpperCase();
}

export function formatAbsoluteUtc(value: bigint | number | undefined, locale?: string): string {
  const date = safeDate(value);
  if (!date) return "—";
  return `${fmt(date, locale, ABSOLUTE_UTC_FORMAT)} UTC`;
}

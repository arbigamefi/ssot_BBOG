import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DomainSportsMarket, DomainSportsResult } from "@ssot/ssot";

import { providerOutcomeById, type SportsbookProviderOdds } from "./provider-odds";

/**
 * ResultPanel — visible only when a market is `resultProposed`, `challenged`,
 * `resolved`, or `voided`. Tells the player which outcome won, when the
 * result was proposed, when the challenge window closes, and whether a
 * dispute is in progress.
 *
 * The panel surfaces chain-derived facts (proposer, reporter set, evidence
 * hash) at a glance, with the deeper proof drawer staying on /ops/sportsbook.
 */
export function ResultPanel({
  market,
  result,
  odds
}: {
  market: DomainSportsMarket;
  result?: DomainSportsResult;
  odds?: SportsbookProviderOdds;
}) {
  const t = useTranslations("sportsbook.player.detail.result");
  const locale = useLocale();
  if (!result || result.proposedAt === 0) {
    if (market.state === "voided") {
      return <Banner tone="void" title={t("voidedTitle")} description={t("voidedDescription")} />;
    }
    return null;
  }

  const winning = providerOutcomeById(odds, Number(result.winningOutcomeId));
  const winningName =
    winning?.name ?? t("outcomeIdFallback", { outcomeId: result.winningOutcomeId });

  const isChallenged = market.state === "challenged" || result.challenged;
  const isFinal = market.state === "resolved";

  const tone: BannerTone = isChallenged ? "warn" : isFinal ? "success" : "info";
  const title = isChallenged
    ? t("challengedTitle")
    : isFinal
      ? t("settledTitle", { outcome: winningName })
      : t("proposedTitle", { outcome: winningName });

  return (
    <Banner
      tone={tone}
      title={title}
      description={
        isChallenged
          ? t("challengedDescription")
          : isFinal
            ? t("settledDescription")
            : t("proposedDescription", {
                finalizes: formatRelative(result.finalizesAt, locale)
              })
      }
    >
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-fg-muted">
        <Cell label={t("rows.proposer")} value={shortAddress(result.proposer)} />
        <Cell
          label={t("rows.reporterCount")}
          value={`${result.reporterCount}/${result.reporterThreshold}`}
        />
        <Cell label={t("rows.proposedAt")} value={formatAbsolute(result.proposedAt, locale)} />
        <Cell label={t("rows.finalizesAt")} value={formatAbsolute(result.finalizesAt, locale)} />
      </dl>
    </Banner>
  );
}

type BannerTone = "success" | "warn" | "info" | "void";

const TONE_MAP: Record<BannerTone, { bg: string; border: string; dot: string; title: string }> = {
  success: {
    bg: "bg-success-soft",
    border: "border-success/30",
    dot: "bg-success",
    title: "text-success"
  },
  warn: {
    bg: "bg-warn-soft",
    border: "border-warn/30",
    dot: "bg-warn",
    title: "text-warn"
  },
  info: {
    bg: "bg-brand-soft",
    border: "border-brand/30",
    dot: "bg-brand",
    title: "text-brand"
  },
  void: {
    bg: "bg-surface-2",
    border: "border-border",
    dot: "bg-fg-subtle",
    title: "text-fg-muted"
  }
};

function Banner({
  tone,
  title,
  description,
  children
}: {
  tone: BannerTone;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const s = TONE_MAP[tone];
  return (
    <aside className={`rounded-lg border ${s.border} ${s.bg} p-4 md:p-5`}>
      <header className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
        <h3 className={`text-sm font-semibold ${s.title}`}>{title}</h3>
      </header>
      <p className="mt-2 text-sm leading-6 text-fg">{description}</p>
      {children}
    </aside>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xs text-fg">{value}</dd>
    </div>
  );
}

function shortAddress(value: string | undefined): string {
  if (!value || value.length <= 12) return value ?? "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatAbsolute(value: number | undefined, locale: string): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value * 1000)
    );
  } catch {
    return new Date(value * 1000).toISOString();
  }
}

function formatRelative(seconds: number | undefined, locale: string): string {
  if (!seconds) return "—";
  const diffMs = seconds * 1000 - Date.now();
  if (diffMs <= 0) return formatAbsolute(seconds, locale);
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

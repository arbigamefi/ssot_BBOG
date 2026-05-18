"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@ssot/ssot/sdk";
import { toast } from "@ssot/ui";
import {
  ClipboardDocumentIcon,
  LinkIcon,
  LockClosedIcon,
  SparklesIcon,
  UserGroupIcon
} from "@heroicons/react/24/outline";

import { PageTransition } from "../../../../components/PageTransition";
import { ProductStateCard } from "../../../../components/ProductStateCard";
import { useAffiliateBets } from "../../../../features/betting/useAffiliateBets";
import { useRelease } from "../../../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../../../ssot/sdk";
import { formatTokenAmount, shortHex } from "../../../../features/portfolio/claims/format";
import {
  buildCasinoReferralLink,
  isZeroAddress,
  normalizeReferralAddress
} from "../../../../features/referral/referral-link";

export function ReferralPageClient() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const { release, readOnly, readOnlyReason, chainId } = useRelease();
  const { sdk, ready } = useSSOTSDK();
  const [origin, setOrigin] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [binding, setBinding] = React.useState(false);

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const assetMeta = release?.assets[0];
  const claimsPool =
    release?.pools.find((pool) => pool.active && String(pool.domain).toLowerCase() === "casino") ??
    release?.pools[0];
  const poolId = claimsPool?.poolId;
  const decimals = assetMeta?.decimals ?? claimsPool?.decimals ?? 6;
  const symbol = assetMeta?.symbol ?? claimsPool?.symbol ?? "XP";
  const pendingLabel = t("portfolio.referral.common.pending");
  const pendingReferrer = React.useMemo(
    () => normalizeReferralAddress(searchParams.get("ref"), sdk?.account),
    [searchParams, sdk?.account]
  );

  const {
    data: boundReferrer,
    isLoading: referrerLoading,
    refetch: refetchReferrer
  } = useQuery({
    queryKey: ["ssot", "referral", "referrer", chainId, sdk?.account ?? "anonymous"],
    enabled: Boolean(sdk?.account && ready),
    queryFn: async () => {
      if (!sdk?.account) throw new Error(t("portfolio.referral.errors.walletUnavailable"));
      return sdk.gameHub.referrerOf(sdk.account);
    },
    refetchInterval: 10_000
  });

  const { data: xpBuckets, isLoading: xpLoading } = useQuery({
    queryKey: ["ssot", "referral", "xp", chainId, poolId, sdk?.account ?? "anonymous"],
    enabled: Boolean(sdk?.account && ready && poolId),
    queryFn: async () => {
      if (!sdk?.account) throw new Error(t("portfolio.referral.errors.walletUnavailable"));
      if (!poolId) throw new Error(t("portfolio.referral.errors.poolUnavailable"));
      return sdk.bank.getXPBuckets(poolId, sdk.account);
    },
    refetchInterval: 10_000
  });
  const affiliateBetsQuery = useAffiliateBets({
    affiliate: sdk?.account,
    chainId,
    enabled: Boolean(sdk?.account && ready),
    limit: 8
  });

  if (!release) {
    return (
      <ProductStateCard
        title={t("portfolio.referral.state.noRelease.title")}
        description={readOnlyReason ?? t("portfolio.referral.state.noRelease.description")}
      />
    );
  }

  const referralLink =
    origin && sdk?.account
      ? buildCasinoReferralLink({ origin, referrer: sdk.account, gameSlug: "dice" })
      : undefined;
  const hasBoundReferrer = !isZeroAddress(boundReferrer);
  const canBindReferrer = Boolean(
    pendingReferrer && !hasBoundReferrer && !readOnly && sdk?.account
  );

  const handleCopy = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleBindReferrer = async () => {
    if (!sdk || !pendingReferrer || !canBindReferrer) return;
    setBinding(true);
    try {
      const result = await sdk.gameHub.bindReferrer(pendingReferrer as Address);
      if (!result.ok) {
        toast.error(result.error?.message ?? t("portfolio.referral.toast.bindFailed"));
        return;
      }
      toast.success(t("portfolio.referral.toast.bound"));
      await refetchReferrer();
    } catch (error) {
      toast.error((error as Error)?.message ?? t("portfolio.referral.toast.bindFailed"));
    } finally {
      setBinding(false);
    }
  };

  return (
    <PageTransition pageKey="referral">
      <div className="space-y-8">
        <section className="rounded-lg border border-border bg-surface-1 p-6 shadow-e2">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
                {t("portfolio.referral.hero.eyebrow")}
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-fg md:text-5xl">
                {t("portfolio.referral.hero.title")}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-fg-muted">
                {t("portfolio.referral.hero.description")}
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface-0 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-fg-subtle">
                {t("portfolio.referral.hero.connected")}
              </p>
              <div className="mt-2 font-mono text-2xl font-black text-fg">
                {sdk?.account
                  ? shortHex(sdk.account, pendingLabel)
                  : t("portfolio.referral.common.notConnected")}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <div className="rounded-md border border-border bg-surface-1 p-5 shadow-e1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-fg">
                    <LinkIcon className="h-5 w-5 text-brand" />
                    {t("portfolio.referral.link.title")}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-fg-muted">
                    {t("portfolio.referral.link.description")}
                  </p>
                </div>
                <Link
                  href="/affiliate"
                  className="rounded-full border border-border bg-surface-2 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-fg-subtle transition-colors hover:border-brand/60 hover:text-fg"
                >
                  {t("portfolio.referral.link.learn")}
                </Link>
              </div>
              <div className="mt-5 rounded-md border border-border bg-surface-0 p-4 font-mono text-sm text-fg-muted">
                {referralLink ?? t("portfolio.referral.link.connect")}
              </div>
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={!referralLink}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-bold text-fg transition-colors hover:border-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
                {copied ? t("portfolio.referral.link.copied") : t("portfolio.referral.link.copy")}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <ReferralMetric
                icon={<SparklesIcon className="h-5 w-5" />}
                label={t("portfolio.referral.metrics.accrued.label")}
                value={formatTokenAmount(xpBuckets?.accrued, decimals, symbol, 4, pendingLabel)}
                detail={t("portfolio.referral.metrics.accrued.detail")}
                loading={xpLoading}
              />
              <ReferralMetric
                icon={<LockClosedIcon className="h-5 w-5" />}
                label={t("portfolio.referral.metrics.locked.label")}
                value={formatTokenAmount(xpBuckets?.locked, decimals, symbol, 4, pendingLabel)}
                detail={t("portfolio.referral.metrics.locked.detail")}
                loading={xpLoading}
              />
              <ReferralMetric
                icon={<UserGroupIcon className="h-5 w-5" />}
                label={t("portfolio.referral.metrics.holdback.label")}
                value={formatTokenAmount(xpBuckets?.holdback, decimals, symbol, 4, pendingLabel)}
                detail={t("portfolio.referral.metrics.holdback.detail")}
                loading={xpLoading}
              />
            </div>

            <div className="rounded-md border border-border bg-surface-1 p-5 shadow-e1">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-black text-fg">
                    {t("portfolio.referral.activity.title")}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-fg-muted">
                    {t("portfolio.referral.activity.description")}
                  </p>
                </div>
                <div className="rounded-full border border-border bg-surface-0 px-3 py-1 font-mono text-xs font-bold text-fg-subtle">
                  {affiliateBetsQuery.data?.source ?? "—"}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <AffiliateStat
                  label={t("portfolio.referral.activity.stats.bets")}
                  value={String(affiliateBetsQuery.data?.stats.betCount ?? 0)}
                />
                <AffiliateStat
                  label={t("portfolio.referral.activity.stats.turnover")}
                  value={formatIndexedAmount(
                    affiliateBetsQuery.data?.stats.turnover,
                    decimals,
                    symbol,
                    pendingLabel
                  )}
                />
                <AffiliateStat
                  label={t("portfolio.referral.activity.stats.settled")}
                  value={String(affiliateBetsQuery.data?.stats.settledCount ?? 0)}
                />
              </div>

              <div className="mt-5 overflow-hidden rounded-md border border-border">
                {(affiliateBetsQuery.data?.rows ?? []).length > 0 ? (
                  <div className="divide-y divide-border">
                    {affiliateBetsQuery.data!.rows.slice(0, 5).map((row) => (
                      <div
                        key={row.id}
                        className="grid gap-3 bg-surface-0 px-4 py-3 text-sm md:grid-cols-[1fr_1fr_0.8fr_0.8fr]"
                      >
                        <span className="font-mono text-fg">{shortHex(row.player)}</span>
                        <span className="font-mono text-fg-muted">
                          {formatIndexedAmount(row.stake, decimals, symbol, pendingLabel)}
                        </span>
                        <span className="font-mono text-fg-muted">#{row.betId}</span>
                        <span className="text-right text-xs font-black uppercase tracking-[0.12em] text-brand">
                          {row.state}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-surface-0 px-4 py-6 text-sm text-fg-muted">
                    {affiliateBetsQuery.isLoading
                      ? t("portfolio.referral.activity.loading")
                      : t("portfolio.referral.activity.empty")}
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-md border border-border bg-surface-1 p-5 shadow-e1">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">
              {t("portfolio.referral.binding.eyebrow")}
            </p>
            <h2 className="mt-3 text-2xl font-black text-fg">
              {t("portfolio.referral.binding.title")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-fg-muted">
              {t("portfolio.referral.binding.description")}
            </p>

            <div className="mt-5 space-y-3">
              <BindingRow
                label={t("portfolio.referral.binding.current")}
                value={
                  referrerLoading
                    ? pendingLabel
                    : hasBoundReferrer
                      ? shortHex(boundReferrer, pendingLabel)
                      : t("portfolio.referral.binding.none")
                }
              />
              <BindingRow
                label={t("portfolio.referral.binding.pending")}
                value={
                  pendingReferrer
                    ? shortHex(pendingReferrer, pendingLabel)
                    : t("portfolio.referral.binding.noPending")
                }
              />
            </div>

            <button
              type="button"
              disabled={!canBindReferrer || binding}
              onClick={() => void handleBindReferrer()}
              className="mt-5 w-full rounded-md bg-brand px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-fg-inverse transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {binding
                ? t("portfolio.referral.binding.binding")
                : t("portfolio.referral.binding.bind")}
            </button>
            <Link
              href="/portfolio/claims"
              className="mt-3 block rounded-md border border-border bg-surface-0 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.14em] text-fg transition-colors hover:border-brand/60"
            >
              {t("portfolio.referral.binding.claims")}
            </Link>
          </aside>
        </section>
      </div>
    </PageTransition>
  );
}

function ReferralMetric({
  icon,
  label,
  value,
  detail,
  loading
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-1 p-5 shadow-e1">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-3 font-mono text-2xl font-black text-fg">{loading ? "..." : value}</div>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{detail}</p>
    </div>
  );
}

function AffiliateStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-0 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </div>
      <div className="mt-2 font-mono text-xl font-black text-fg">{value}</div>
    </div>
  );
}

function BindingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-0 px-4 py-3">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-fg-subtle">{label}</span>
      <span className="font-mono text-sm font-bold text-fg">{value}</span>
    </div>
  );
}

function formatIndexedAmount(
  value: string | undefined,
  decimals: number,
  symbol: string,
  pendingLabel: string
) {
  if (value == null) return pendingLabel;
  try {
    return formatTokenAmount(BigInt(value), decimals, symbol, 4, pendingLabel);
  } catch {
    return pendingLabel;
  }
}

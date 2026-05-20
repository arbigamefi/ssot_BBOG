"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ClipboardDocumentIcon,
  LinkIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon
} from "@heroicons/react/24/outline";

import { useSSOTSDK } from "../../../ssot/sdk";
import { buildCasinoReferralLink } from "../../../features/referral/referral-link";
import { shortHex } from "../../../features/portfolio/claims/format";

export function AffiliatePageClient() {
  const t = useTranslations();
  const { sdk } = useSSOTSDK();
  const [origin, setOrigin] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const referralLink =
    origin && sdk?.account
      ? buildCasinoReferralLink({ origin, referrer: sdk.account, gameSlug: "dice" })
      : undefined;

  const handleCopy = React.useCallback(async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [referralLink]);

  return (
    <div className="space-y-10 pb-20 pt-32">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-brand">
            {t("affiliate.hero.eyebrow")}
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[1.05] tracking-tight text-fg md:text-7xl">
            {t("affiliate.hero.title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-fg-muted">
            {t("affiliate.hero.description")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/casino/dice"
              className="rounded-md bg-brand px-5 py-3 text-center text-sm font-black uppercase tracking-[0.14em] text-fg-inverse shadow-e2 transition-colors hover:bg-brand/90"
            >
              {t("affiliate.hero.primary")}
            </Link>
            <Link
              href="/portfolio/referral"
              className="rounded-md border border-border bg-surface-1 px-5 py-3 text-center text-sm font-black uppercase tracking-[0.14em] text-fg transition-colors hover:border-brand/60"
            >
              {t("affiliate.hero.secondary")}
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-1 p-6 shadow-e2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-brand/40 bg-brand/10 text-brand">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-fg-subtle">
                {t("affiliate.linkCard.eyebrow")}
              </p>
              <h2 className="text-xl font-black text-fg">{t("affiliate.linkCard.title")}</h2>
            </div>
          </div>

          <div className="mt-5 rounded-md border border-border bg-surface-0 p-4 font-mono text-sm text-fg-muted">
            {referralLink ?? t("affiliate.linkCard.connect")}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={!referralLink}
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-bold text-fg transition-colors hover:border-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              {copied ? t("affiliate.linkCard.copied") : t("affiliate.linkCard.copy")}
            </button>
            <span className="text-xs text-fg-subtle">
              {sdk?.account
                ? t("affiliate.linkCard.wallet", { wallet: shortHex(sdk.account) })
                : t("affiliate.linkCard.walletPending")}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <AffiliatePillar
          icon={<UserGroupIcon className="h-6 w-6" />}
          title={t("affiliate.pillars.firstTouch.title")}
          body={t("affiliate.pillars.firstTouch.body")}
        />
        <AffiliatePillar
          icon={<SparklesIcon className="h-6 w-6" />}
          title={t("affiliate.pillars.xp.title")}
          body={t("affiliate.pillars.xp.body")}
        />
        <AffiliatePillar
          icon={<ShieldCheckIcon className="h-6 w-6" />}
          title={t("affiliate.pillars.chain.title")}
          body={t("affiliate.pillars.chain.body")}
        />
      </section>

      <section className="rounded-lg border border-border bg-surface-1 p-6 shadow-e2">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
              {t("affiliate.flow.eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-fg">
              {t("affiliate.flow.title")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-fg-muted">{t("affiliate.flow.body")}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rounded-md border border-border bg-surface-0 p-5">
                <div className="font-mono text-xs font-black text-brand">0{index + 1}</div>
                <h3 className="mt-3 text-lg font-black text-fg">
                  {t(`affiliate.flow.steps.${index}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-fg-muted">
                  {t(`affiliate.flow.steps.${index}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function AffiliatePillar({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-1 p-6 shadow-e1">
      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-surface-0 text-brand">
        {icon}
      </div>
      <h2 className="mt-5 text-xl font-black text-fg">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-fg-muted">{body}</p>
    </div>
  );
}

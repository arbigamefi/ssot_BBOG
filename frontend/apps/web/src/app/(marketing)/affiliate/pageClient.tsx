"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ClipboardDocumentIcon,
  LinkIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon
} from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { useSSOTSDK } from "../../../ssot/sdk";
import { useConnectModal } from "../../../app-shell/WalletButton";
import { buildCasinoReferralLink } from "../../../features/referral/referral-link";
import { SharePanel } from "../../../features/share/SharePanel";
import { shortHex } from "../../../features/portfolio/claims/format";

export function AffiliatePageClient() {
  const t = useTranslations();
  const { sdk } = useSSOTSDK();
  const { openConnectModal } = useConnectModal();
  const [origin, setOrigin] = React.useState("");
  const [copiedCampaign, setCopiedCampaign] = React.useState<string | undefined>();

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const referralLink =
    origin && sdk?.account
      ? buildCasinoReferralLink({ origin, referrer: sdk.account, gameSlug: "dice" })
      : undefined;
  const shareLink = referralLink;
  const referralLinkPreview = React.useMemo(
    () => formatReferralLinkPreview(shareLink),
    [shareLink]
  );

  const campaignChannels = ["x", "telegram", "whatsapp"] as const;
  const handleCampaignCopy = React.useCallback(
    async (channel: (typeof campaignChannels)[number]) => {
      if (!shareLink) return;
      await navigator.clipboard.writeText(
        t(`affiliate.kit.channels.${channel}.text`, { link: shareLink })
      );
      setCopiedCampaign(channel);
      window.setTimeout(() => setCopiedCampaign(undefined), 1600);
    },
    [shareLink, t]
  );

  return (
    <div className="min-w-0 space-y-8 overflow-x-hidden pb-20 pt-28 md:space-y-10 md:pt-32">
      <section className="grid min-w-0 gap-8 overflow-hidden lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div className="min-w-0 max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand">
            {t("affiliate.hero.eyebrow")}
          </p>
          <h1 className="mt-5 max-w-full text-balance break-words text-3xl font-bold leading-[1.08] tracking-normal text-fg sm:text-5xl md:max-w-4xl md:text-6xl">
            {t("affiliate.hero.title")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-fg-muted md:text-lg md:leading-8">
            {t("affiliate.hero.description")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#referral-link"
              className="w-full rounded-md bg-brand px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.14em] text-fg-inverse shadow-e2 transition-colors hover:bg-brand/90 sm:w-auto"
            >
              {t("affiliate.hero.primary")}
            </a>
            <Link
              href="/portfolio/referral"
              className="w-full rounded-md border border-border bg-surface-1 px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.14em] text-fg transition-colors hover:border-brand/60 sm:w-auto"
            >
              {t("affiliate.hero.secondary")}
            </Link>
          </div>
        </div>

        <div
          id="referral-link"
          className="min-w-0 scroll-mt-28 rounded-lg border border-border bg-surface-1 p-6 shadow-e2"
        >
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

          <div
            className={cn(
              "mt-5 min-w-0 overflow-hidden rounded-md border bg-surface-0 p-4 font-mono text-sm",
              referralLink
                ? "border-border text-fg-muted"
                : "border-border-soft border-dashed text-fg-subtle"
            )}
            title={referralLink}
          >
            <span className="block max-w-full truncate">
              {referralLinkPreview ?? t("affiliate.linkCard.connect")}
            </span>
          </div>
          <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            {referralLink ? (
              <div className="w-full sm:w-auto">
                <SharePanel
                  labels={{
                    close: t("casino.room.result.actions.close"),
                    copyLink: t("affiliate.linkCard.copy"),
                    linkCopied: t("affiliate.linkCard.copied"),
                    nativeShare: t("casino.room.result.actions.nativeShare"),
                    share: t("affiliate.linkCard.share"),
                    telegram: t("casino.room.result.actions.shareToTelegram"),
                    whatsapp: t("casino.room.result.actions.shareToWhatsApp"),
                    x: t("casino.room.result.actions.shareToX")
                  }}
                  text={t("affiliate.linkCard.shareText")}
                  title={t("affiliate.linkCard.title")}
                  triggerClassName="py-2 text-sm normal-case tracking-normal"
                  url={referralLink}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={openConnectModal}
                className="inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-fg-inverse transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-auto"
              >
                {t("app.connectWalletButton")}
              </button>
            )}
            <span className="min-w-0 truncate text-xs text-fg-subtle">
              {sdk?.account
                ? t("affiliate.linkCard.wallet", { wallet: shortHex(sdk.account) })
                : t("affiliate.linkCard.walletPending")}
            </span>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-6 rounded-lg border border-border bg-surface-1 p-5 shadow-e2 lg:grid-cols-[0.75fr_1.25fr] lg:p-6">
        <div className="min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-brand/40 bg-brand/10 text-brand">
            <MegaphoneIcon className="h-5 w-5" />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            {t("affiliate.kit.eyebrow")}
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-normal text-fg md:text-3xl">
            {t("affiliate.kit.title")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-fg-muted">{t("affiliate.kit.body")}</p>
        </div>

        <div className="grid min-w-0 gap-3">
          {campaignChannels.map((channel) => {
            const preview = shareLink
              ? t(`affiliate.kit.channels.${channel}.text`, { link: shareLink })
              : t(`affiliate.kit.channels.${channel}.pending`, {
                  link: t("affiliate.kit.pendingLink")
                });
            return (
              <div
                key={channel}
                className="grid min-w-0 gap-3 rounded-md border border-border-soft bg-surface-0 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-fg">
                    {t(`affiliate.kit.channels.${channel}.title`)}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-fg-muted [overflow-wrap:anywhere]">
                    {preview}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!referralLink}
                  onClick={() => void handleCampaignCopy(channel)}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-bold text-fg transition-colors hover:border-brand/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ClipboardDocumentIcon className="h-4 w-4" />
                  {copiedCampaign === channel ? t("affiliate.kit.copied") : t("affiliate.kit.copy")}
                </button>
              </div>
            );
          })}
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
      <h2 className="mt-5 text-xl font-bold text-fg">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-fg-muted">{body}</p>
    </div>
  );
}

function formatReferralLinkPreview(link?: string) {
  if (!link) return undefined;
  try {
    const url = new URL(link);
    const referrer = url.searchParams.get("ref");
    const ref = referrer ? shortHex(referrer) : undefined;
    return `${url.origin}${url.pathname}${ref ? `?ref=${ref}` : ""}`;
  } catch {
    return link;
  }
}

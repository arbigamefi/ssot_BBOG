"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, WalletIcon } from "@heroicons/react/24/outline";
import { useWalletEntry } from "./wallet-entry-context";

export function MobileWalletDeepLinkBanner({
  menu = false,
  onOpen
}: {
  menu?: boolean;
  onOpen?: () => void;
}) {
  const entry = useWalletEntry();
  const t = useTranslations("app.mobileWallet");
  if (!entry?.eligible || (!menu && entry.dismissed)) return null;
  const launch = () => {
    onOpen?.();
    entry.open();
  };
  if (menu)
    return (
      <button
        type="button"
        onClick={launch}
        className="mt-3 min-h-12 w-full rounded-lg bg-brand px-4 text-base font-bold text-fg-inverse hover:bg-brand-hover"
      >
        {t("title")}
      </button>
    );
  return (
    <aside
      aria-label={t("title")}
      className="mt-6 rounded-xl border border-brand/40 bg-brand-soft p-4 shadow-e2 md:hidden"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand text-fg-inverse">
          <WalletIcon aria-hidden className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-6 text-fg">{t("inlineTitle")}</p>
          <p className="mt-1 text-sm leading-5 text-fg-muted">{t("hint")}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={launch}
        className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-brand px-4 text-base font-bold text-fg-inverse shadow-e2 hover:bg-brand-hover"
      >
        {t("title")}
        <ArrowRightIcon aria-hidden className="h-5 w-5" />
      </button>
      {entry.mainnetUnavailable ? (
        <p className="mt-2 text-xs leading-5 text-fg-muted">{t("unavailableHint")}</p>
      ) : null}
    </aside>
  );
}

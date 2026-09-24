"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { WalletIcon } from "@heroicons/react/24/outline";
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
        className="mt-3 min-h-11 w-full rounded-lg border border-border-soft px-3 text-sm font-semibold text-fg"
      >
        {t("title")}
      </button>
    );
  return (
    <aside
      aria-label={t("title")}
      className="mt-4 flex items-center gap-3 rounded-xl border border-border-soft bg-surface-1 p-3 md:hidden"
    >
      <WalletIcon aria-hidden className="h-6 w-6 shrink-0 text-brand" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-fg">{t("inlineTitle")}</p>
        <p className="mt-1 text-xs leading-5 text-fg-muted">
          {t(entry.mainnetUnavailable ? "unavailableHint" : "hint")}
        </p>
      </div>
      <button
        type="button"
        onClick={launch}
        className="min-h-11 shrink-0 rounded-lg border border-brand/30 px-3 text-xs font-semibold text-brand"
      >
        {t("choose")}
      </button>
    </aside>
  );
}

"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowTopRightOnSquareIcon, WalletIcon } from "@heroicons/react/24/outline";
import { Sheet } from "../components/overlay";
import { WALLET_OPTIONS, walletDeepLink } from "./mobile-wallet-links";
const LAST_WALLET_KEY = "arbigamefi.mobileDeepLink.lastWallet";
function readSession(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* Optional preference. */
  }
}
export function MobileWalletSheet({
  destination,
  pathname,
  mainnetUnavailable,
  onClose,
  onStay
}: {
  destination: string;
  pathname: string;
  mainnetUnavailable: boolean;
  onClose: () => void;
  onStay: () => void;
}) {
  const t = useTranslations("app.mobileWallet");
  const [lastWallet, setLastWallet] = React.useState<string | null>(null);
  const [attempted, setAttempted] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    setLastWallet(readSession(LAST_WALLET_KEY));
  }, []);
  const wallets = [...WALLET_OPTIONS].sort(
    (a, b) => Number(b.id === lastWallet) - Number(a.id === lastWallet)
  );
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(destination);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={t("sheetTitle")} closeLabel={t("dismiss")}>
      <p className="mb-4 text-sm leading-6 text-fg-muted">{t("description")}</p>
      {mainnetUnavailable ? (
        <p className="mb-4 rounded-lg border border-border-soft bg-surface-2 p-3 text-xs leading-5 text-fg-muted">
          {t("unavailableHint")}{" "}
          <Link
            href={`${pathname}?chainId=84532`}
            onClick={onClose}
            className="font-semibold text-brand underline"
          >
            {t("tryTestnet")}
          </Link>
        </p>
      ) : null}
      <div className="space-y-2">
        {wallets.map((wallet) => (
          <a
            key={wallet.id}
            href={destination ? walletDeepLink(wallet.id, destination) : undefined}
            onClick={() => {
              setAttempted(wallet.name);
              setLastWallet(wallet.id);
              writeSession(LAST_WALLET_KEY, wallet.id);
            }}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-border-soft bg-surface-2 px-4 py-3 text-fg hover:border-brand/40"
          >
            <WalletIcon aria-hidden className="h-6 w-6 shrink-0 text-brand" />
            <span className="flex-1">
              <span className="block text-sm font-semibold">{wallet.name}</span>
              <span className="text-xs text-fg-muted">{t("openBrowser")}</span>
            </span>
            <ArrowTopRightOnSquareIcon aria-hidden className="h-4 w-4" />
          </a>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          onStay();
        }}
        className="mt-3 min-h-12 w-full rounded-lg text-sm font-semibold text-fg-muted hover:bg-surface-2"
      >
        {t("stay")}
      </button>
      {attempted ? (
        <div className="mt-3 rounded-lg border border-border-soft p-3">
          <p role="status" className="text-xs leading-5 text-fg-muted">
            {t("attempted", { wallet: attempted })}
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="mt-1 min-h-11 text-sm font-semibold text-brand"
          >
            {t(copied ? "copied" : "copy")}
          </button>
          <input
            readOnly
            aria-label={t("currentLink")}
            value={destination}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded border border-border-soft bg-surface-0 p-2 text-xs text-fg-muted"
          />
        </div>
      ) : null}
      <p className="mt-3 text-center text-xs text-fg-subtle">
        {destination ? new URL(destination).host : ""}
      </p>
    </Sheet>
  );
}

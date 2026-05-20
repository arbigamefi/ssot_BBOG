"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@ssot/ui";
import { useConnectModal } from "../app-shell/WalletButton";

/**
 * Friendly prompt shown when a page requires a connected wallet.
 * Replaces the generic WALLET_NOT_CONNECTED error callout.
 */
export function ConnectWalletPrompt({ action }: { action?: string }) {
  const t = useTranslations("app");
  const { openConnectModal } = useConnectModal();

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{t("walletRequired")}</CardTitle>
        <CardDescription>
          {action ? t("connectWalletActionDescription", { action }) : t("connectWalletDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          onClick={openConnectModal}
          className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-bold text-fg-inverse transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {t("connectWalletButton")}
        </button>
      </CardContent>
    </Card>
  );
}

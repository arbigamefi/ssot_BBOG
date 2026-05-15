"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@ssot/ui";
import { useConnectModal } from "../app-shell/WalletButton";

/**
 * Friendly prompt shown when a page requires a connected wallet.
 * Replaces the generic WALLET_NOT_CONNECTED error callout.
 */
export function ConnectWalletPrompt({ action }: { action?: string }) {
  const { openConnectModal } = useConnectModal();

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Wallet required</CardTitle>
        <CardDescription>
          {action ? `Connect a wallet to ${action}.` : "Connect a wallet to use this feature."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          onClick={openConnectModal}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Connect Wallet
        </button>
      </CardContent>
    </Card>
  );
}

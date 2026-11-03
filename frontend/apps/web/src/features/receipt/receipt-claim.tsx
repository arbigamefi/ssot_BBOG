"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Address } from "@ssot/ssot/sdk";

import { requestWalletConnect } from "../../app-shell/wallet-connect-events";
import { useRelease } from "../../ssot/release/ReleaseProvider";
import { useSSOTSDK } from "../../ssot/sdk";
import { useClaimPlayerPayable, usePlayerPayable } from "../portfolio/claims/player-payable-claim";
import { RECEIPT_LINK } from "./printed-receipt";
import { exactAmount } from "./receipt";

const CLAIM_BUTTON =
  "mt-3 flex min-h-12 w-full items-center justify-center rounded-print border border-transparent bg-ink px-4 text-center font-semibold text-paper hover:bg-ink-bright disabled:cursor-default disabled:border-faded disabled:bg-transparent disabled:text-faded focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink";

/**
 * On a voided receipt, or one whose payout was held: what the pool owes the player now, and the
 * claim. The balance is the pool's whole debt to the player, which can include other bets.
 */
export function ReceiptClaim({
  chainId,
  poolId,
  player,
  symbol,
  decimals
}: {
  chainId: number;
  poolId: number;
  player: Address;
  symbol: string;
  decimals: number;
}) {
  const t = useTranslations("portfolio.claims.payable");
  const { sdk } = useSSOTSDK();
  const { readOnly } = useRelease();
  const payable = usePlayerPayable({ chainId, poolId, player });
  const amount = payable.data;
  const amountLabel = amount == null ? "" : `${exactAmount(amount, decimals)} ${symbol}`;
  const { claim, claiming } = useClaimPlayerPayable({ chainId, poolId, player, amountLabel });

  let body: React.ReactNode;
  if (sdk && sdk.release.chainId !== chainId) {
    body = (
      <Link href={`/portfolio/claims?chainId=${chainId}`} className={RECEIPT_LINK}>
        {t("openClaims")}
      </Link>
    );
  } else if (payable.error) {
    body = <p role="alert">{t("unavailable")}</p>;
  } else if (amount == null) {
    return null;
  } else if (amount === 0n) {
    body = <p className="text-faded">{t("nothing")}</p>;
  } else {
    const connected = Boolean(sdk?.account);
    body = (
      <>
        <p className="font-semibold">{t("claimable", { amount: amountLabel })}</p>
        <button
          type="button"
          disabled={claiming || (connected && readOnly)}
          onClick={() => (connected ? void claim() : requestWalletConnect())}
          className={CLAIM_BUTTON}
        >
          {!connected
            ? t("connect")
            : claiming
              ? t("claiming")
              : t("claim", { amount: amountLabel })}
        </button>
        <p className="mt-2 text-faded">{t("note")}</p>
      </>
    );
  }
  return (
    <div className="mt-4 border-t border-thermal pt-4 text-note" data-testid="receipt-claim">
      {body}
    </div>
  );
}

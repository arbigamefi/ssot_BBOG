"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { CasinoAccess } from "../../../app-shell/casino-access";

/** The line over a game room off the live site: a preview, or test tokens on a test network. */
export function RoomStrip({
  access,
  chainName,
  symbol
}: {
  access: CasinoAccess;
  chainName: string;
  symbol: string;
}) {
  const t = useTranslations("casino.table.strip");
  if (access === "live") return null;
  return (
    <p className="border-b border-rule-carbon bg-carbon-deep py-2 text-note text-on-carbon-muted">
      <span className="mx-auto box-content block max-w-page px-gutter">
        {access === "preview" ? t("preview") : t("testnet", { chain: chainName, symbol })}
      </span>
    </p>
  );
}

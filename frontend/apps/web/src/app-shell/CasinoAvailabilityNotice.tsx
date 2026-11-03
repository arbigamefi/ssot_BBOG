"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { OFFICIAL_CHANNELS, TESTNET_USDC_FAUCET } from "../config/site";
import { getCasinoAccess } from "./casino-access";
import { getAppChain } from "./chain-registry";

export function CasinoAvailabilityNotice({ chainId }: { chainId?: number }) {
  const t = useTranslations("casino.availability");
  const pathname = usePathname();
  if (!chainId) return null;
  const access = getCasinoAccess(chainId);
  if (access === "live") return null;
  if (pathname !== "/casino" && !/^\/casino\/[^/]+$/.test(pathname)) return null;
  const testnet = access === "testnet";
  const title = testnet ? t("testnet.title") : t("title");
  return (
    <aside
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface-2 p-4"
      aria-label={title}
    >
      <div>
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">
          {testnet
            ? t("testnet.description", { chain: getAppChain(chainId)?.name ?? String(chainId) })
            : t("description")}
        </p>
      </div>
      <a
        href={testnet ? TESTNET_USDC_FAUCET : OFFICIAL_CHANNELS.telegram}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex min-h-11 items-center rounded-lg border border-brand/30 px-4 text-sm font-semibold text-brand hover:bg-brand-soft"
      >
        {testnet ? t("testnet.faucet") : t("followTelegram")}
      </a>
    </aside>
  );
}

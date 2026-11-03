"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { mainnet } from "wagmi/chains";
import { useAccount, useDisconnect, useEnsName, useSwitchChain } from "wagmi";
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";

import { useActiveChain } from "./ActiveChainProvider";
import { getExplorerAddressUrl } from "./chain-registry";
import { FOCUS_ON_CARBON, MENU_PANEL, MENU_ROW, WALLET_NAV } from "./site-nav";
import { useHeaderMenu } from "./use-header-menu";
import { useConnectModal } from "./wallet-entry-context";

const ENS_LOOKUP_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ENS_LOOKUP === "true";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** The one filled button on carbon is paper; ink never sits on carbon. */
const CONNECT_BUTTON = `inline-grid min-h-11 place-items-center rounded-print bg-paper px-4 font-semibold whitespace-nowrap text-ink hover:bg-on-carbon-muted disabled:cursor-default disabled:opacity-60 ${FOCUS_ON_CARBON}`;
const ICON_BUTTON = `grid size-11 shrink-0 place-items-center rounded-print text-on-carbon-muted hover:text-paper ${FOCUS_ON_CARBON}`;

/**
 * The header's wallet control. Disconnected, it opens the wallet selector. Connected, it
 * shows the address and opens the player's own pages (Portfolio, Bets, Claims), a fix
 * when the wallet sits on another chain, and Disconnect.
 */
export function WalletHeaderMenu() {
  const t = useTranslations("app.walletMenu");
  const { address, isConnected, connector, chainId: walletChainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { selectedChainId, selectedChain, supportedChains, setSelectedChainId } = useActiveChain();
  const { switchChain, isPending: switching } = useSwitchChain();
  // Reverse ENS is opt-in so the header adds no Ethereum mainnet reads by default.
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
    query: { enabled: ENS_LOOKUP_ENABLED && Boolean(address), retry: false }
  });
  const menu = useHeaderMenu();

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        data-tour="wallet"
        onClick={() => openConnectModal?.()}
        disabled={!openConnectModal}
        className={CONNECT_BUTTON}
      >
        {t("connect")}
      </button>
    );
  }

  const mismatch = walletChainId !== selectedChainId;
  const explorerUrl = getExplorerAddressUrl(selectedChainId, address);
  const chainName = selectedChain?.name ?? String(selectedChainId);

  return (
    <div ref={menu.rootRef} onBlur={menu.onBlur} className="relative" data-tour="wallet">
      <button
        {...menu.triggerProps}
        aria-label={t("open", { address: ensName ?? shortAddress(address) })}
        className={`inline-flex min-h-11 items-center gap-2 rounded-print border border-current px-3 font-semibold tabular-nums text-paper hover:bg-paper hover:text-ink aria-expanded:bg-paper aria-expanded:text-ink ${FOCUS_ON_CARBON}`}
      >
        {mismatch ? <ExclamationTriangleIcon aria-hidden className="size-4" /> : null}
        <span className="max-w-[9rem] truncate">{ensName ?? shortAddress(address)}</span>
        <ChevronDownIcon aria-hidden className="size-4" />
      </button>

      <div
        id={menu.panelId}
        hidden={!menu.open}
        className={`${MENU_PANEL} w-[min(20rem,calc(100vw-2rem))]`}
      >
        <div className="flex items-center gap-1 pr-2 pb-2 pl-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold tabular-nums">
              {ensName ?? shortAddress(address)}
            </p>
            {connector?.name ? (
              <p className="truncate text-on-carbon-muted">
                {t("connectedVia", { wallet: connector.name })}
              </p>
            ) : null}
          </div>
          <CopyAddress value={address} />
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t("viewOnExplorer")}
              className={ICON_BUTTON}
            >
              <ArrowTopRightOnSquareIcon aria-hidden className="size-5" />
            </a>
          ) : null}
        </div>

        {mismatch ? (
          <div role="status" className="border-t border-rule-carbon px-4 py-3">
            <p className="font-semibold">{t("mismatch.title")}</p>
            <p className="mt-1 text-on-carbon-muted">
              {t("mismatch.description", { target: chainName })}
            </p>
            <button
              type="button"
              disabled={switching}
              onClick={() => switchChain({ chainId: selectedChainId })}
              className={`mt-3 inline-grid min-h-11 place-items-center rounded-print border border-current px-3 font-semibold hover:bg-paper hover:text-ink disabled:cursor-default disabled:opacity-60 ${FOCUS_ON_CARBON}`}
            >
              {switching ? t("mismatch.switching") : t("mismatch.switch")}
            </button>
          </div>
        ) : null}

        {supportedChains.length > 1 ? (
          <div className="border-t border-rule-carbon pt-2">
            <p className="px-4 pb-1 text-on-carbon-muted">{t("network")}</p>
            <ul>
              {supportedChains.map((chain) => (
                <li key={chain.id}>
                  <button
                    type="button"
                    aria-current={chain.id === selectedChainId ? "true" : undefined}
                    onClick={() => {
                      setSelectedChainId(chain.id);
                      menu.close();
                    }}
                    className={`${MENU_ROW} justify-between aria-[current]:font-semibold`}
                  >
                    {chain.name}
                    {chain.id === selectedChainId ? (
                      <span aria-hidden className="size-2 rounded-full bg-paper" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <nav aria-label={t("pages")} className="mt-2 border-t border-rule-carbon pt-2">
          <ul>
            {WALLET_NAV.map((item) => (
              <li key={item.key}>
                <Link href={item.href} onClick={menu.close} className={MENU_ROW}>
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-2 border-t border-rule-carbon pt-2">
          <button
            type="button"
            onClick={() => {
              disconnect();
              menu.close();
            }}
            className={MENU_ROW}
          >
            {t("disconnect")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyAddress({ value }: { value: string }) {
  const t = useTranslations("app.walletMenu");
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={copied ? t("copied") : t("copyAddress")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // A denied clipboard leaves the address on screen to copy by hand.
        }
      }}
      className={ICON_BUTTON}
    >
      {copied ? (
        <CheckIcon aria-hidden className="size-5" />
      ) : (
        <ClipboardIcon aria-hidden className="size-5" />
      )}
    </button>
  );
}

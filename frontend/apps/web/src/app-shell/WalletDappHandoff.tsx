"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useActiveChain } from "./ActiveChainProvider";
import { isMobileBrowser, isWalletBrowser } from "./mobile-wallet-browser";
import {
  getWalletDappHandoff,
  openWalletDapp,
  type WalletDappHandoff as Handoff
} from "./wallet-dapp-links";

// RainbowKit has no public before-select hook. This adapter is scoped to its
// pinned 2.2.11 selector, with real-selector E2E coverage. Capturing the click
// avoids an async pairing request consuming Safari's user activation.
export function WalletDappHandoff() {
  const t = useTranslations("app.mobileWallet");
  const { selectedChainId } = useActiveChain();
  const [eligible, setEligible] = React.useState(false);
  const [handoff, setHandoff] = React.useState<Handoff>();

  React.useEffect(() => {
    let announced = false;
    const canHandoff = () => !announced && isMobileBrowser(window) && !isWalletBrowser(window);
    const refresh = () => setEligible(canHandoff());
    const providerAnnounced = () => {
      announced = true;
      setEligible(false);
      setHandoff(undefined);
    };
    const onClick = (event: MouseEvent) => {
      if (
        !canHandoff() ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>(
        'button[data-testid^="rk-wallet-option-"]'
      );
      if (
        !button ||
        button.disabled ||
        !button.closest('[role="dialog"][aria-labelledby="rk_connect_title"]')
      )
        return;
      const next = getWalletDappHandoff(
        button.dataset.testid!.slice("rk-wallet-option-".length),
        window.location.href,
        selectedChainId,
        /iPhone|iPad|iPod/i.test(window.navigator.userAgent) ||
          (/Macintosh/i.test(window.navigator.userAgent) && window.navigator.maxTouchPoints > 0)
      );
      if (!next) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setHandoff(next);
      // No await, relay request, popup, or timed App Store redirect.
      openWalletDapp(next.href);
    };
    refresh();
    document.addEventListener("click", onClick, true);
    window.addEventListener("focus", refresh);
    window.addEventListener("ethereum#initialized", refresh);
    window.addEventListener("eip6963:announceProvider", providerAnnounced);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("ethereum#initialized", refresh);
      window.removeEventListener("eip6963:announceProvider", providerAnnounced);
    };
  }, [selectedChainId]);

  if (!eligible) return null;
  return (
    <div className="text-sm leading-5 text-fg-muted" data-testid="wallet-dapp-handoff">
      <p>{t("browserHint")}</p>
      {handoff ? (
        <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
          <p role="status">{t("notOpened", { wallet: handoff.name })}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <a
              href={handoff.href}
              className="inline-flex min-h-11 items-center rounded-lg bg-brand px-3 font-semibold text-fg-inverse"
            >
              {t("retryOpen")}
            </a>
            <a
              href={handoff.downloadHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-fg"
            >
              {t("downloadWallet")}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

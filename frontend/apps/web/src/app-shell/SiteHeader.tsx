"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

import { useOverlayController } from "../components/overlay";
import { LanguageList, LanguageMenu } from "./LanguageMenu";
import { FOCUS_ON_CARBON, SITE_NAV, getSiteSection, type SiteSection } from "./site-nav";
import { WalletHeaderMenu } from "./WalletHeaderMenu";

/** The width at which the sections fit in the bar and the menu button goes away. */
const WIDE = "(min-width: 64rem)";
const BAR = "mx-auto box-content flex h-16 max-w-page items-center gap-6 px-gutter md:h-20";
const WORDMARK = `shrink-0 text-lede font-extrabold tracking-[-0.01em] text-paper ${FOCUS_ON_CARBON}`;

function currentFor(pathname: string, href: string, section: SiteSection) {
  if (pathname === href) return "page" as const;
  return getSiteSection(pathname) === section ? ("true" as const) : undefined;
}

/**
 * The site's one navigation bar, on carbon above every page:
 * wordmark, Casino, Liquidity, Rewards, Help, language and wallet.
 * Phones keep the wordmark and the wallet, and a menu button opens the rest.
 */
export function SiteHeader() {
  const t = useTranslations("app.nav");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const closeMenu = React.useCallback(() => setMenuOpen(false), []);

  return (
    <header className="relative z-50 bg-carbon font-text text-body text-paper">
      <div className={BAR}>
        <Link href="/" className={WORDMARK}>
          ArbiGameFi
        </Link>
        <nav aria-label={t("label")} className="hidden lg:block">
          <ul className="flex items-center gap-6">
            {SITE_NAV.map((item) => (
              <li key={item.section}>
                <Link
                  href={item.href}
                  aria-current={currentFor(pathname, item.href, item.section)}
                  className={`inline-flex min-h-11 items-center whitespace-nowrap text-on-carbon-muted decoration-2 underline-offset-8 hover:text-paper aria-[current]:font-semibold aria-[current]:text-paper aria-[current]:underline ${FOCUS_ON_CARBON}`}
                >
                  {t(item.section)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-note md:gap-4">
          <div className="hidden lg:block">
            <LanguageMenu />
          </div>
          <WalletHeaderMenu />
          <button
            type="button"
            aria-label={t("openMenu")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className={`grid size-11 shrink-0 place-items-center rounded-print border border-current text-paper lg:hidden ${FOCUS_ON_CARBON}`}
          >
            <Bars3Icon aria-hidden className="size-5" />
          </button>
        </div>
      </div>
      <MobileMenu open={menuOpen} pathname={pathname} onClose={closeMenu} />
    </header>
  );
}

/** The phone menu: the same sections as the bar, then the languages. */
function MobileMenu({
  open,
  pathname,
  onClose
}: {
  open: boolean;
  pathname: string;
  onClose: () => void;
}) {
  const t = useTranslations("app.nav");
  const languageT = useTranslations("locale");
  const titleId = React.useId();
  const { panelRef } = useOverlayController<HTMLDivElement>({
    lockScroll: true,
    onClose,
    open,
    trapFocus: true
  });

  // The menu button is gone on a wide screen, so the menu must not stay open there.
  React.useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return;
    const wide = window.matchMedia(WIDE);
    const closeIfWide = () => {
      if (wide.matches) onClose();
    };
    closeIfWide();
    wide.addEventListener("change", closeIfWide);
    return () => wide.removeEventListener("change", closeIfWide);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-carbon pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className={BAR}>
        <Link href="/" onClick={onClose} className={WORDMARK}>
          ArbiGameFi
        </Link>
        <h2 id={titleId} className="sr-only">
          {t("menu")}
        </h2>
        <button
          type="button"
          aria-label={t("closeMenu")}
          onClick={onClose}
          className={`ml-auto grid size-11 shrink-0 place-items-center rounded-print border border-current text-paper ${FOCUS_ON_CARBON}`}
        >
          <XMarkIcon aria-hidden className="size-5" />
        </button>
      </div>
      <div className="mx-auto box-content max-w-page px-gutter pb-section">
        <nav aria-label={t("label")}>
          <ul className="border-b border-rule-carbon">
            {SITE_NAV.map((item) => (
              <li key={item.section} className="border-t border-rule-carbon">
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={currentFor(pathname, item.href, item.section)}
                  className={`flex min-h-14 items-center text-lede font-semibold text-paper decoration-2 underline-offset-8 aria-[current]:underline ${FOCUS_ON_CARBON}`}
                >
                  {t(item.section)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby={`${titleId}-language`} className="mt-head text-note">
          <h3 id={`${titleId}-language`} className="mb-2 text-on-carbon-muted">
            {languageT("label")}
          </h3>
          <div className="-mx-4">
            <LanguageList onSelect={onClose} />
          </div>
        </section>
      </div>
    </div>
  );
}

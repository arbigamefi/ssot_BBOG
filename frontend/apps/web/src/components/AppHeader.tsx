import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowPathIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { ShellHeader, ShellHeaderNav, ShellHeaderActions } from "@ssot/ui";
import { cn } from "@ssot/ui";
import { WalletHeaderMenu } from "../app-shell/WalletHeaderMenu";
import { DisconnectedChainSwitcher } from "../app-shell/ChainSwitcher";
import { MobileWalletDeepLinkBanner } from "../app-shell/MobileWalletDeepLinkBanner";
import { ArbiGameFiMark } from "./ArbiGameFiBrand";
import { LocaleSheetSwitcher, LocaleSwitcher } from "./LocaleSwitcher";
import { Drawer } from "./overlay";

export type AppRoute =
  | "directory"
  | "sportsbook"
  | "bets"
  | "liquidity"
  | "claims"
  | "referral"
  | "account"
  | "ops"
  | "none"
  | "dice"
  | "plinko"
  | "slots"
  | "baccarat"
  | "sicbo"
  | "roulette"
  | "cointoss"
  | "keno";
export type HeaderVariant = "default" | "game" | "transparent";

interface AppHeaderProps {
  activeRoute?: AppRoute;
  variant?: HeaderVariant;
}

const GAME_NAV_LINKS = [
  { id: "dice", labelKey: "nav.dice", href: "/casino/dice" },
  { id: "plinko", labelKey: "nav.plinko", href: "/casino/plinko" },
  { id: "slots", labelKey: "nav.slots", href: "/casino/slots" },
  { id: "baccarat", labelKey: "nav.baccarat", href: "/casino/baccarat" },
  { id: "sicbo", labelKey: "nav.sicBo", href: "/casino/sic-bo" },
  { id: "roulette", labelKey: "nav.roulette", href: "/casino/roulette" },
  { id: "cointoss", labelKey: "nav.coinToss", href: "/casino/coin-toss" },
  { id: "keno", labelKey: "nav.keno", href: "/casino/keno" }
] as const;

const PRODUCT_NAV_LINKS = [
  { id: "sportsbook", labelKey: "nav.sportsbook", href: "/sportsbook" },
  { id: "liquidity", labelKey: "nav.liquidity", href: "/earn" },
  { id: "referral", labelKey: "nav.affiliates", href: "/portfolio/referral" }
] as const;

const ACCOUNT_NAV_LINKS = [
  { id: "account", labelKey: "nav.account", href: "/portfolio" },
  { id: "bets", labelKey: "nav.bets", href: "/portfolio/activity" },
  { id: "claims", labelKey: "nav.claims", href: "/portfolio/claims" }
] as const;

const SUPPORT_NAV_LINKS = [
  { id: "support", labelKey: "nav.support", href: "/support" },
  { id: "status", labelKey: "nav.status", href: "/status" }
] as const;

function MobileHeaderBrand({ compactUntilLg = false }: { compactUntilLg?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="ArbiGameFi"
      className="inline-flex shrink-0 items-center gap-2 text-xl font-bold tracking-tight text-fg"
    >
      <ArbiGameFiMark className="h-9 w-9 rounded-xl" />
      <span className={compactUntilLg ? "hidden lg:inline" : "hidden sm:inline"}>ArbiGameFi</span>
    </Link>
  );
}

function MobileNavSection({
  title,
  links,
  activeRoute,
  onNavigate,
  variant = "list"
}: {
  title: string;
  links: readonly { id: string; labelKey: string; href: string }[];
  activeRoute: AppRoute;
  onNavigate: () => void;
  variant?: "list" | "grid";
}) {
  const t = useTranslations();
  const isGrid = variant === "grid";
  return (
    <section
      className={cn(
        "border-t border-border-soft first:border-t-0 first:pt-0",
        isGrid ? "py-3" : "py-4"
      )}
    >
      <h3 className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
        {title}
      </h3>
      <div className={cn("mt-2 grid gap-1", isGrid && "grid-cols-2 gap-1.5")}>
        {links.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center justify-between rounded-md border font-semibold transition-colors",
              isGrid ? "min-h-9 px-2.5 text-xs" : "min-h-11 px-3 text-sm",
              activeRoute === link.id
                ? "border-brand/55 bg-brand-soft text-fg ring-1 ring-brand/20"
                : "border-transparent text-fg-muted hover:border-border-soft hover:bg-surface-2 hover:text-fg"
            )}
          >
            <span className="min-w-0 truncate">{t(link.labelKey)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MobileNavDrawer({
  open,
  activeRoute,
  onClose
}: {
  open: boolean;
  activeRoute: AppRoute;
  onClose: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();

  const refreshPage = React.useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <Drawer
      closeLabel={t("nav.closeMenu")}
      contentClassName="flex flex-col overflow-hidden"
      onClose={onClose}
      open={open}
      title={<MobileHeaderBrand />}
    >
      <div className="border-b border-border-soft px-4 py-4">
        <div className="min-w-0 [&>button]:w-full [&>div]:w-full [&>div>button]:w-full">
          <WalletHeaderMenu hideDisconnectedChainSwitcher mode="sheet" />
        </div>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-label={t("nav.menu")}>
        <MobileNavSection
          title={t("nav.casino")}
          links={[{ id: "directory", labelKey: "nav.games", href: "/casino" }, ...GAME_NAV_LINKS]}
          activeRoute={activeRoute}
          onNavigate={onClose}
          variant="grid"
        />
        <MobileNavSection
          title={t("nav.product")}
          links={PRODUCT_NAV_LINKS}
          activeRoute={activeRoute}
          onNavigate={onClose}
        />
        <MobileNavSection
          title={t("nav.account")}
          links={ACCOUNT_NAV_LINKS}
          activeRoute={activeRoute}
          onNavigate={onClose}
        />
        <MobileNavSection
          title={t("nav.support")}
          links={SUPPORT_NAV_LINKS}
          activeRoute={activeRoute}
          onNavigate={onClose}
        />
      </nav>
      <div className="border-t border-border-soft px-4 py-4">
        <DisconnectedChainSwitcher mode="sheet" />
        <LocaleSheetSwitcher className="mt-3" />
        <button
          type="button"
          aria-label={t("nav.refresh")}
          onClick={refreshPage}
          className="mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 text-left text-sm font-semibold text-fg-muted transition-colors hover:border-border hover:text-fg"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border-soft bg-surface-1 text-fg-muted">
              <ArrowPathIcon className="h-4 w-4" />
            </span>
            <span className="truncate">{t("nav.refresh")}</span>
          </span>
        </button>
      </div>
    </Drawer>
  );
}

export function AppHeader({ activeRoute = "none", variant = "default" }: AppHeaderProps) {
  const isTransparent = variant === "transparent";
  const t = useTranslations();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const openMobileMenu = React.useCallback(() => setMobileMenuOpen(true), []);
  const closeMobileMenu = React.useCallback(() => setMobileMenuOpen(false), []);
  const mobileGameNavRef = React.useRef<HTMLElement | null>(null);
  const activeMobileGameLinkRef = React.useRef<HTMLAnchorElement | null>(null);

  React.useEffect(() => {
    if (variant !== "game") return;
    const nav = mobileGameNavRef.current;
    const activeLink = activeMobileGameLinkRef.current;
    if (!nav || !activeLink) return;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeLink.scrollIntoView?.({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center"
    });
  }, [activeRoute, variant]);

  if (isTransparent) {
    return (
      <>
        <header className="fixed inset-x-0 top-0 z-50 border-b border-border-soft bg-surface-0/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6 md:h-20">
            <div className="flex items-center gap-4 lg:gap-12">
              <MobileHeaderBrand compactUntilLg />
              <nav className="hidden shrink-0 items-center gap-4 whitespace-nowrap text-sm font-medium text-fg-muted md:flex lg:gap-6">
                <Link href="/casino" className="transition-colors hover:text-fg">
                  {t("nav.rooms")}
                </Link>
                <Link href="/earn" className="transition-colors hover:text-fg">
                  {t("nav.liquidity")}
                </Link>
                <Link href="/affiliate" className="transition-colors hover:text-fg">
                  {t("nav.affiliates")}
                </Link>
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap lg:gap-4">
              <div className="hidden sm:block">
                <LocaleSwitcher compact />
              </div>
              <div className="hidden md:block">
                <WalletHeaderMenu />
              </div>
              <div className="md:hidden">
                <WalletHeaderMenu
                  hideDisconnectedChainSwitcher
                  mode="sheet"
                  compactDisconnectedLabel
                />
              </div>
              <Link
                href="/casino"
                className="hidden rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-fg-inverse transition-colors hover:bg-fg/90 lg:inline-flex"
              >
                {t("nav.openRooms")}
              </Link>
              <button
                type="button"
                aria-label={t("nav.openMenu")}
                onClick={openMobileMenu}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-border-soft bg-surface-1 text-fg md:hidden"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>
        <MobileNavDrawer
          open={mobileMenuOpen}
          activeRoute={activeRoute}
          onClose={closeMobileMenu}
        />
      </>
    );
  }

  const navLinks = [
    { id: "directory", label: t("nav.games"), href: "/casino" },
    { id: "sportsbook", label: t("nav.sportsbook"), href: "/sportsbook" },
    { id: "bets", label: t("nav.bets"), href: "/portfolio/activity" },
    { id: "liquidity", label: t("nav.liquidity"), href: "/earn" },
    { id: "claims", label: t("nav.claims"), href: "/portfolio/claims" },
    { id: "referral", label: t("nav.affiliates"), href: "/portfolio/referral" },
    { id: "account", label: t("nav.account"), href: "/portfolio" }
  ] as const;
  const mobileGameNav =
    variant === "game" ? (
      <div className="border-b border-border bg-surface-0/95 px-4 py-1.5 backdrop-blur md:hidden">
        <nav
          ref={mobileGameNavRef}
          aria-label={t("nav.casino")}
          className="flex gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Link
            href="/casino"
            className="shrink-0 rounded-full border border-border-soft bg-surface-2 px-3 py-1.5 text-xs font-semibold text-fg-subtle"
          >
            ← {t("nav.casino")}
          </Link>
          {GAME_NAV_LINKS.map((link) => (
            <Link
              key={link.id}
              ref={activeRoute === link.id ? activeMobileGameLinkRef : undefined}
              href={link.href}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                activeRoute === link.id
                  ? "border-brand bg-brand text-fg-inverse"
                  : "border-border-soft bg-surface-2 text-fg-subtle hover:text-fg"
              )}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
      </div>
    ) : null;

  const headerBar = (
    <ShellHeader variant="solid" sticky={variant !== "game"}>
      <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-8">
        <MobileHeaderBrand />

        {variant === "game" ? (
          <ShellHeaderNav className="flex-1 basis-0 gap-5 overscroll-x-contain pr-4">
            <Link
              href="/casino"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap [word-break:keep-all] text-fg-subtle transition-colors hover:text-fg"
            >
              <span>←</span>
              <span>{t("nav.casino")}</span>
            </Link>

            {GAME_NAV_LINKS.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className={cn(
                  "inline-flex shrink-0 items-center whitespace-nowrap [word-break:keep-all] transition-colors",
                  activeRoute === link.id
                    ? "border-b-2 border-brand pb-1 text-brand"
                    : "text-fg-subtle hover:text-fg"
                )}
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </ShellHeaderNav>
        ) : (
          <ShellHeaderNav className="flex-1">
            {navLinks.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                className={cn(
                  "inline-flex shrink-0 items-center whitespace-nowrap [word-break:keep-all] transition-colors",
                  activeRoute === link.id
                    ? "border-b-2 border-fg pb-1 text-fg"
                    : "text-fg-subtle hover:text-fg"
                )}
              >
                {link.label}
              </Link>
            ))}
          </ShellHeaderNav>
        )}
      </div>

      <ShellHeaderActions>
        <div className="hidden sm:block">
          <LocaleSwitcher compact />
        </div>
        <div className="hidden md:block">
          <WalletHeaderMenu />
        </div>
        <div className="md:hidden">
          <WalletHeaderMenu hideDisconnectedChainSwitcher mode="sheet" compactDisconnectedLabel />
        </div>
        <button
          type="button"
          aria-label={t("nav.openMenu")}
          onClick={openMobileMenu}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-border-soft bg-surface-1 text-fg md:hidden"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
      </ShellHeaderActions>
    </ShellHeader>
  );

  return (
    <>
      {variant === "game" ? (
        <div className="sticky top-0 z-50">
          {headerBar}
          {mobileGameNav}
        </div>
      ) : (
        headerBar
      )}
      <MobileWalletDeepLinkBanner />
      {variant === "game" ? null : mobileGameNav}
      <MobileNavDrawer open={mobileMenuOpen} activeRoute={activeRoute} onClose={closeMobileMenu} />
    </>
  );
}

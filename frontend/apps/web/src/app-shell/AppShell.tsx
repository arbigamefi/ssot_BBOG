"use client";

import * as React from "react";
import { ReadOnlyBanner } from "@ssot/ui";
import { AppShell as AppShellFrame } from "@ssot/ui/patterns";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { useRelease } from "../ssot/release/ReleaseProvider";
import { DISABLE_AGE_GATE_IN_DEV, DISABLE_ONBOARDING_IN_DEV } from "../config/dev-flags";
import { isCasinoModuleSlug } from "../features/casino/modules";
import {
  AgeTermsGate,
  CookieConsentBanner,
  RealityCheckTimer,
  ResponsibleGamblingDialog,
  SelfExclusionGate
} from "./compliance";
import { OnboardingTour } from "./onboarding/OnboardingTour";
import { MobileWalletEntryProvider } from "./MobileWalletEntryProvider";
import { CasinoAvailabilityNotice } from "./CasinoAvailabilityNotice";
import { InstallPrompt } from "./pwa/InstallPrompt";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

function isCasinoGameRoom(pathname: string) {
  const match = /^\/casino\/([^/?#]+)$/.exec(pathname);
  return match ? isCasinoModuleSlug(match[1] ?? "") : false;
}

/** Pages rebuilt in Carbon copy run edge to edge and print their own site state (01-brand §11). */
export function isCarbonCopyPage(pathname: string) {
  return pathname === "/" || pathname === "/casino/dice";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations();
  const { readOnly, readOnlyReason, warnings, chainId } = useRelease();

  return (
    <MobileWalletEntryProvider>
      <AppShellFrame
        skipLinkLabel={t("app.skipToContent")}
        fullBleed={isCarbonCopyPage(pathname)}
        footer={<SiteFooter />}
        header={<SiteHeader />}
        readOnlyBanner={
          readOnly ? (
            <ReadOnlyBanner
              title={t("app.readOnlyTitle")}
              reason={readOnlyReason ?? t("app.writesDisabled")}
              details={warnings}
            />
          ) : undefined
        }
        variant={isCasinoGameRoom(pathname) ? "game" : "product"}
      >
        <SelfExclusionGate>
          <CasinoAvailabilityNotice chainId={chainId} />
          {children}
        </SelfExclusionGate>
      </AppShellFrame>

      {/* Compliance surfaces — render above the shell, ordered by priority:
          age/terms gate blocks everything; cookie banner + RG dialog sit on
          top; the reality-check timer is invisible bookkeeping. */}
      {DISABLE_AGE_GATE_IN_DEV ? null : <AgeTermsGate />}
      <CookieConsentBanner />
      <ResponsibleGamblingDialog />
      <RealityCheckTimer />
      {DISABLE_ONBOARDING_IN_DEV ? null : <OnboardingTour />}
      <InstallPrompt />
    </MobileWalletEntryProvider>
  );
}

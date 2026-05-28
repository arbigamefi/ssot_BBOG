"use client";

import * as React from "react";

/**
 * Single source of truth for client-side compliance state.
 *
 * Everything here is localStorage-backed and advisory at the UI layer — the
 * real teeth (geo-blocking, sanctions screening, deposit/loss enforcement)
 * must live server-side / on-chain. This provider exists so those rules have
 * a place to hook in with ZERO additional UI work once they land.
 *
 * Bump TERMS_VERSION whenever the Terms / Privacy change materially — it
 * forces every returning user back through the acceptance gate.
 */
export const TERMS_VERSION = "2026-05-28";

export type CookieConsent = "accepted" | "rejected";

export type ResponsibleGamblingLimits = {
  /** Player-set daily deposit ceiling in USDC. Enforcement is server-side. */
  dailyDepositLimit?: number;
  /** Player-set daily loss ceiling in USDC. Enforcement is server-side. */
  dailyLossLimit?: number;
  /** Minutes between in-session "reality check" reminders. 0 = off. */
  sessionReminderMinutes?: number;
  /** Epoch ms until which the player has excluded themselves. */
  selfExcludedUntil?: number;
};

type TermsRecord = { version: string; acceptedAt: number };

type ComplianceContextValue = {
  hydrated: boolean;
  ageConfirmed: boolean;
  terms: TermsRecord | null;
  termsCurrent: boolean;
  /** Both age confirmed AND current terms accepted — the gate to enter. */
  entryCleared: boolean;
  cookieConsent: CookieConsent | null;
  limits: ResponsibleGamblingLimits;
  isSelfExcluded: boolean;
  selfExcludedUntil?: number;

  confirmAgeAndTerms: () => void;
  setCookieConsent: (consent: CookieConsent) => void;
  setLimits: (partial: ResponsibleGamblingLimits) => void;
  selfExclude: (durationMs: number) => void;

  rgDialogOpen: boolean;
  openRgDialog: () => void;
  closeRgDialog: () => void;
};

const ComplianceContext = React.createContext<ComplianceContextValue | null>(null);

const KEY_AGE = "arbigamefi.compliance.age.v1";
const KEY_TERMS = "arbigamefi.compliance.terms.v1";
const KEY_COOKIES = "arbigamefi.compliance.cookies.v1";
const KEY_LIMITS = "arbigamefi.compliance.rg.v1";

function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be unavailable (private mode) — degrade silently.
  }
}

export function ComplianceProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = React.useState(false);
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);
  const [terms, setTerms] = React.useState<TermsRecord | null>(null);
  const [cookieConsent, setCookieConsentState] = React.useState<CookieConsent | null>(null);
  const [limits, setLimitsState] = React.useState<ResponsibleGamblingLimits>({});
  const [rgDialogOpen, setRgDialogOpen] = React.useState(false);

  // Hydrate from storage once on mount — guards against SSR/client flash.
  React.useEffect(() => {
    setAgeConfirmed(readJSON<boolean>(KEY_AGE) === true);
    setTerms(readJSON<TermsRecord>(KEY_TERMS));
    setCookieConsentState(readJSON<CookieConsent>(KEY_COOKIES));
    setLimitsState(readJSON<ResponsibleGamblingLimits>(KEY_LIMITS) ?? {});
    setHydrated(true);
  }, []);

  const confirmAgeAndTerms = React.useCallback(() => {
    const record: TermsRecord = { version: TERMS_VERSION, acceptedAt: Date.now() };
    writeJSON(KEY_AGE, true);
    writeJSON(KEY_TERMS, record);
    setAgeConfirmed(true);
    setTerms(record);
  }, []);

  const setCookieConsent = React.useCallback((consent: CookieConsent) => {
    writeJSON(KEY_COOKIES, consent);
    setCookieConsentState(consent);
  }, []);

  const setLimits = React.useCallback((partial: ResponsibleGamblingLimits) => {
    setLimitsState((prev) => {
      const next = { ...prev, ...partial };
      writeJSON(KEY_LIMITS, next);
      return next;
    });
  }, []);

  const selfExclude = React.useCallback((durationMs: number) => {
    setLimitsState((prev) => {
      const next = { ...prev, selfExcludedUntil: Date.now() + durationMs };
      writeJSON(KEY_LIMITS, next);
      return next;
    });
    setRgDialogOpen(false);
  }, []);

  const termsCurrent = terms?.version === TERMS_VERSION;
  const entryCleared = ageConfirmed && termsCurrent;
  const selfExcludedUntil = limits.selfExcludedUntil;
  const isSelfExcluded = Boolean(selfExcludedUntil && selfExcludedUntil > Date.now());

  const value = React.useMemo<ComplianceContextValue>(
    () => ({
      hydrated,
      ageConfirmed,
      terms,
      termsCurrent,
      entryCleared,
      cookieConsent,
      limits,
      isSelfExcluded,
      selfExcludedUntil,
      confirmAgeAndTerms,
      setCookieConsent,
      setLimits,
      selfExclude,
      rgDialogOpen,
      openRgDialog: () => setRgDialogOpen(true),
      closeRgDialog: () => setRgDialogOpen(false)
    }),
    [
      hydrated,
      ageConfirmed,
      terms,
      termsCurrent,
      entryCleared,
      cookieConsent,
      limits,
      isSelfExcluded,
      selfExcludedUntil,
      confirmAgeAndTerms,
      setCookieConsent,
      setLimits,
      selfExclude,
      rgDialogOpen
    ]
  );

  return <ComplianceContext.Provider value={value}>{children}</ComplianceContext.Provider>;
}

export function useCompliance() {
  const ctx = React.useContext(ComplianceContext);
  if (!ctx) throw new Error("useCompliance must be used within ComplianceProvider");
  return ctx;
}

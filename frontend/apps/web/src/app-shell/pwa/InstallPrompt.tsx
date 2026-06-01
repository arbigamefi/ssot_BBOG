"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowDownTrayIcon, XMarkIcon } from "@heroicons/react/24/outline";

const DISMISS_KEY = "arbigamefi.pwaInstall.dismissedV1";

/**
 * Lightweight PWA install nudge. Captures the browser's deferred
 * `beforeinstallprompt` event (Chromium) and surfaces a single, dismissable
 * card. We never auto-prompt — the user taps "Install" to trigger the native
 * dialog. iOS Safari doesn't fire the event, so the card simply never shows
 * there (no broken UI).
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const t = useTranslations("app.install");
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(DISMISS_KEY) === "1") return;
    // Already installed (standalone display mode) → never show.
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      dismiss();
      setDeferred(null);
    }
  };

  if (!visible || !deferred) return null;

  return (
    <div
      role="region"
      aria-label={t("title")}
      className="fixed bottom-4 right-4 z-[70] w-[20rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border-soft bg-surface-1 p-4 shadow-e3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand/30 bg-brand-soft text-brand">
            <ArrowDownTrayIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-fg">{t("title")}</p>
            <p className="text-[11px] leading-4 text-fg-muted">{t("description")}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label={t("dismiss")}
          onClick={dismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-soft text-fg-muted hover:text-fg"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={install}
        className="mt-3 w-full rounded-md bg-brand px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-fg-inverse transition hover:bg-brand-hover"
      >
        {t("action")}
      </button>
    </div>
  );
}

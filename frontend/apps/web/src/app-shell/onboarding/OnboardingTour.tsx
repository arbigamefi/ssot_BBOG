"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@ssot/ui";

import { useCompliance } from "../compliance";
import { useFocusTrap } from "../a11y/useFocusTrap";
import { overlayZ } from "../../components/overlay/z";
import { isCasinoModuleSlug } from "../../features/casino/modules";

const STORAGE_KEY = "arbigamefi.onboarding.v1";

/**
 * First-run coachmark tour for the game room. Each step optionally anchors to
 * a `[data-tour="..."]` element: when present we spotlight it and float the
 * tip beside it; when absent we fall back to a centered card. Degrades safely
 * if the DOM shifts, so it never blocks the player.
 *
 * Only runs on /casino/[slug] (the first surface where all anchors exist),
 * after the compliance gate clears, and only once per device.
 */
type TourStep = {
  key: string;
  selector?: string;
};

const STEPS: TourStep[] = [
  { key: "welcome" },
  { key: "wallet", selector: '[data-tour="wallet"]' },
  { key: "stage", selector: '[data-tour="game-stage"]' },
  { key: "amount", selector: '[data-tour="bet-amount"]' },
  { key: "place", selector: '[data-tour="place-bet"]' },
  { key: "fairness" }
];

type Rect = { top: number; left: number; width: number; height: number };

function isGameRoom(pathname: string) {
  const match = /^\/casino\/([^/?#]+)$/.exec(pathname);
  return match ? isCasinoModuleSlug(match[1] ?? "") : false;
}

export function OnboardingTour() {
  const t = useTranslations("onboarding");
  const pathname = usePathname();
  const { hydrated, entryCleared } = useCompliance();

  const [active, setActive] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [rect, setRect] = React.useState<Rect | null>(null);

  // Decide whether to run, once, after hydration + gate clear.
  React.useEffect(() => {
    if (!hydrated || !entryCleared) return;
    if (!isGameRoom(pathname)) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "done") return;
    // Let the room render its anchors before starting.
    const id = window.setTimeout(() => setActive(true), 600);
    return () => window.clearTimeout(id);
  }, [hydrated, entryCleared, pathname]);

  const step = STEPS[stepIndex];

  // Measure the current anchor (if any) and keep it fresh on resize/scroll.
  React.useEffect(() => {
    if (!active || !step) return;
    if (!step.selector) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(step.selector as string);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step]);

  const finish = React.useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, "done");
    setActive(false);
  }, []);

  const trapRef = useFocusTrap<HTMLDivElement>(active);

  if (!active || !step) return null;

  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;
  const pad = 8;
  const spotlight: Rect | null = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2
      }
    : null;

  // Tooltip position: under the anchor if there's room, else centered.
  const tipStyle: React.CSSProperties = spotlight
    ? {
        position: "fixed",
        top: Math.min(spotlight.top + spotlight.height + 12, window.innerHeight - 220),
        left: Math.max(12, Math.min(spotlight.left, window.innerWidth - 340))
      }
    : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div
      className={cn("fixed inset-0", overlayZ.onboarding)}
      role="dialog"
      aria-modal="true"
      aria-label={t("aria")}
    >
      {/* Dimmed backdrop with a spotlight cutout (via box-shadow) when anchored. */}
      {spotlight ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-lg ring-2 ring-brand transition-[height,left,top,width]"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px hsl(var(--surface-0) / 0.82)"
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-surface-0/82" />
      )}

      {/* Tooltip card */}
      <div
        ref={trapRef}
        style={tipStyle}
        className="w-[20rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border-soft bg-surface-1 p-5 shadow-e3"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
            {t("stepLabel", { current: stepIndex + 1, total: STEPS.length })}
          </span>
          <button
            type="button"
            onClick={finish}
            className="text-[11px] font-semibold text-fg-subtle hover:text-fg"
          >
            {t("skip")}
          </button>
        </div>

        <h3 className="mt-2 text-base font-bold text-fg">{t(`steps.${step.key}.title`)}</h3>
        <p className="mt-1.5 text-sm leading-6 text-fg-muted">{t(`steps.${step.key}.body`)}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.key}
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  i === stepIndex ? "bg-brand" : "bg-border"
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="rounded-md border border-border-soft bg-surface-2 px-3 py-1.5 text-xs font-semibold text-fg-muted hover:text-fg"
              >
                {t("back")}
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
              className="rounded-md bg-brand px-4 py-1.5 text-xs font-bold text-fg-inverse hover:bg-brand-hover"
            >
              {isLast ? t("done") : t("next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

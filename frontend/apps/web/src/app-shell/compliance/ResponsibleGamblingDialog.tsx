"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@ssot/ui";

import { useCompliance } from "./ComplianceProvider";
import { useFocusTrap } from "../a11y/useFocusTrap";
import { overlayZ } from "../../components/overlay/z";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Player-facing responsible-gambling controls: an in-session reality-check
 * cadence and self-exclusion, both kept in this browser. Daily deposit and loss
 * limits are left out until something enforces them: a limit the site shows but
 * does not apply would let a player believe they are protected.
 */
export function ResponsibleGamblingDialog() {
  const t = useTranslations("compliance.responsible");
  const { rgDialogOpen, closeRgDialog, limits, setLimits, selfExclude } = useCompliance();

  const [reminder, setReminder] = React.useState("");
  const trapRef = useFocusTrap<HTMLDivElement>(rgDialogOpen);

  // Escape closes — this dialog is dismissable (unlike the blocking age gate).
  React.useEffect(() => {
    if (!rgDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRgDialog();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rgDialogOpen, closeRgDialog]);

  React.useEffect(() => {
    if (!rgDialogOpen) return;
    setReminder(limits.sessionReminderMinutes != null ? String(limits.sessionReminderMinutes) : "");
  }, [rgDialogOpen, limits]);

  if (!rgDialogOpen) return null;

  const saveReminder = () => {
    setLimits({
      sessionReminderMinutes: parseOptionalNonNegative(reminder)
    });
    closeRgDialog();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rg-title"
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-surface-0/90 px-4 backdrop-blur",
        overlayZ.gate
      )}
    >
      <div
        ref={trapRef}
        className="w-full max-w-md overflow-hidden rounded-lg border border-border-soft bg-surface-1 shadow-e3"
      >
        <div className="flex items-center justify-between border-b border-border-soft px-6 py-4">
          <h2 id="rg-title" className="text-base font-bold text-fg">
            {t("title")}
          </h2>
          <button
            type="button"
            aria-label={t("close")}
            onClick={closeRgDialog}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border-soft text-fg-muted hover:text-fg"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <p className="text-xs leading-5 text-fg-muted">{t("intro")}</p>

          <ReminderField
            label={t("sessionReminder")}
            suffix={t("minutes")}
            value={reminder}
            onChange={setReminder}
            placeholder={t("off")}
          />

          <button
            type="button"
            onClick={saveReminder}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-fg-inverse transition hover:bg-brand-hover"
          >
            {t("saveReminder")}
          </button>
        </div>

        {/* Self-exclusion — destructive, separated. */}
        <div className="border-t border-border-soft bg-danger-soft/40 px-6 py-5">
          <h3 className="text-sm font-bold text-fg">{t("selfExclude.title")}</h3>
          <p className="mt-1 text-xs leading-5 text-fg-muted">{t("selfExclude.description")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: t("selfExclude.d1"), ms: DAY_MS },
              { label: t("selfExclude.d7"), ms: 7 * DAY_MS },
              { label: t("selfExclude.d30"), ms: 30 * DAY_MS },
              { label: t("selfExclude.d180"), ms: 180 * DAY_MS }
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  if (window.confirm(t("selfExclude.confirm", { period: option.label }))) {
                    selfExclude(option.ms);
                  }
                }}
                className="rounded-md border border-danger/50 px-3 py-1.5 text-xs font-bold text-danger transition hover:bg-danger/10"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReminderField({
  label,
  suffix,
  value,
  onChange,
  placeholder
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-md border border-border-soft bg-surface-0 px-3 py-2">
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value.replace(/[^0-9.]/g, ""))}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle">
          {suffix}
        </span>
      </div>
    </label>
  );
}

/**
 * Parse the typed reminder interval in minutes. Returns undefined for
 * blank/zero/invalid (= off). It is not an asset amount, so a guarded numeric
 * parse is acceptable here.
 */
function parseOptionalNonNegative(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

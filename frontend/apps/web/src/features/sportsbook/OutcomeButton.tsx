import * as React from "react";
import { cn } from "@ssot/ui";

/**
 * OutcomeButton — the canonical "odds box" used on event rows and on the
 * market detail board. Pure presentation. Stake placement happens elsewhere;
 * this component is the click target the operator-facing sportsbook never had.
 *
 * Layout: short label on the left (e.g. "Home / Draw / Away" or team name);
 * decimal odds on the right (mono numerals); selected ring + brand fill when
 * `selected` is true; disabled grey when there is no signed price.
 */
export function OutcomeButton({
  label,
  sublabel,
  price,
  selected,
  disabled,
  onClick,
  size = "default",
  className
}: {
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  price?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: "small" | "default";
  className?: string;
}) {
  const heights = size === "small" ? "h-12 px-3" : "h-14 px-4";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-pressed={selected ?? undefined}
      className={cn(
        "group flex w-full items-center justify-between gap-3 rounded-md border text-left transition-colors",
        heights,
        selected
          ? "border-brand bg-brand text-fg-inverse"
          : "border-border bg-surface-2 text-fg hover:border-brand/60 hover:bg-surface-3",
        disabled && "cursor-not-allowed opacity-60 hover:border-border hover:bg-surface-2",
        className
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span
          className={cn("truncate text-sm font-medium", selected ? "text-fg-inverse" : "text-fg")}
        >
          {label}
        </span>
        {sublabel ? (
          <span
            className={cn(
              "truncate text-[11px] font-medium uppercase tracking-[0.14em]",
              selected ? "text-fg-inverse/80" : "text-fg-subtle"
            )}
          >
            {sublabel}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "shrink-0 font-mono text-base tabular-nums",
          selected ? "text-fg-inverse" : "text-fg"
        )}
      >
        {price ?? "—"}
      </span>
    </button>
  );
}

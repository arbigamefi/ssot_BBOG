"use client";

import * as React from "react";

import { Card } from "../ui/card";
import { Label } from "../ui/label";
import { cn } from "../../lib/utils";

export type AssetOption = {
  address: `0x${string}`;
  symbol: string;
  decimals?: number;
  label?: string;
  disabled?: boolean;
};

export type AssetSelectorProps = {
  title?: string;
  description?: string;
  assets: AssetOption[];
  value?: `0x${string}`;
  onValueChange?: (address: `0x${string}`) => void;
  placeholder?: string;
  showAddress?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  /**
   * Optional leading mark for each asset (e.g. a token logo). Consumer-provided
   * so this component stays token-agnostic — the UI library never depends on
   * app-level token assets.
   */
  renderLogo?: (asset: AssetOption) => React.ReactNode;
  /**
   * "card" — a labelled form field (default), for consoles/forms.
   * "inline" — a compact trigger pill (no card/label), for dense toolbars.
   */
  variant?: "card" | "inline";
};

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function optionText(opt: AssetOption, showAddress: boolean) {
  const base = opt.label?.trim() ? opt.label.trim() : opt.symbol;
  if (!showAddress) return base;
  return `${base} (${shortAddress(opt.address)})`;
}

function ChevronDownGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path
        d="M6 8l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path
        d="M5 10.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type MenuPosition = { top: number; left: number; width: number };

/**
 * Asset selector — a logo-aware listbox shared by the earn console (card
 * variant) and the casino room (inline pill). Replaces a native <select> so
 * each option can carry a token logo; falls back to a static, non-interactive
 * chip when there is nothing to choose (single asset / disabled).
 *
 * The option list uses fixed positioning (anchored to the trigger) so it is
 * never clipped by an `overflow` ancestor (e.g. the scrollable bet panel).
 */
export function AssetSelector(props: AssetSelectorProps) {
  const {
    title = "Asset",
    description,
    assets,
    value,
    onValueChange,
    placeholder = "Select an asset",
    showAddress = false,
    disabled = false,
    error,
    className,
    renderLogo,
    variant = "card"
  } = props;

  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<MenuPosition | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // Drop up when there isn't room below (short lists rarely trigger this).
    const estHeight = Math.min(240, assets.length * 40 + 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < estHeight && rect.top > spaceBelow;
    const viewportPadding = 12;
    const width = Math.min(Math.max(rect.width, 176), window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - width - viewportPadding
    );
    setPosition({
      top: dropUp ? rect.top - estHeight - 4 : rect.bottom + 4,
      left,
      width
    });
  }, [assets.length]);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onReflow = () => updatePosition();
    // Capture phase catches scrolling in any ancestor, not just the window.
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, updatePosition]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = assets.find(
    (asset) => asset.address.toLowerCase() === (value ?? "").toLowerCase()
  );
  const interactive = !disabled && assets.length > 1 && Boolean(onValueChange);

  const triggerInner = (
    <span className="inline-flex min-w-0 items-center gap-2">
      {selected && renderLogo ? renderLogo(selected) : null}
      <span
        className={cn(
          "truncate",
          variant === "inline" ? "font-mono text-sm font-bold text-fg" : "text-sm text-fg"
        )}
      >
        {selected
          ? optionText(selected, showAddress)
          : assets.length === 0
            ? "No assets"
            : placeholder}
      </span>
    </span>
  );

  const menu =
    open && position ? (
      <div
        ref={listRef}
        role="listbox"
        aria-label={title}
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          width: position.width
        }}
        className="z-[80] max-h-60 overflow-auto rounded-md border border-border-soft bg-surface-1 p-1 shadow-e3"
      >
        {assets.map((asset) => {
          const active = asset.address.toLowerCase() === (value ?? "").toLowerCase();
          return (
            <button
              key={asset.address}
              type="button"
              role="option"
              aria-selected={active}
              disabled={asset.disabled}
              onClick={() => {
                if (asset.disabled) return;
                onValueChange?.(asset.address);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                active ? "bg-brand-soft text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                asset.disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {renderLogo ? renderLogo(asset) : null}
              <span className="min-w-0 flex-1 truncate font-mono font-bold">
                {optionText(asset, showAddress)}
              </span>
              {active ? <CheckGlyph className="h-4 w-4 shrink-0 text-brand" /> : null}
            </button>
          );
        })}
      </div>
    ) : null;

  if (variant === "inline") {
    if (!interactive) {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-surface-1 px-2.5 py-1.5",
            className
          )}
        >
          {triggerInner}
        </span>
      );
    }
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={title}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-surface-1 px-2.5 py-1.5 transition-colors hover:border-brand/40",
            className
          )}
        >
          {triggerInner}
          <ChevronDownGlyph
            className={cn(
              "h-4 w-4 shrink-0 text-fg-subtle transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
        {menu}
      </>
    );
  }

  return (
    <Card className={className}>
      <div className="space-y-2 p-4">
        <div className="space-y-1">
          <Label>{title}</Label>
          {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
        </div>

        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={title}
          disabled={disabled || assets.length === 0}
          onClick={() => interactive && setOpen((current) => !current)}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface-0 px-3 text-sm text-fg transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-brand",
            "disabled:cursor-not-allowed disabled:border-border-soft disabled:text-fg-subtle",
            error ? "border-danger/50 focus:ring-danger/40" : "",
            !interactive && "cursor-default"
          )}
        >
          {triggerInner}
          {interactive ? (
            <ChevronDownGlyph
              className={cn(
                "h-4 w-4 shrink-0 text-fg-subtle transition-transform",
                open && "rotate-180"
              )}
            />
          ) : null}
        </button>
        {menu}

        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
      </div>
    </Card>
  );
}

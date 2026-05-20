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
};

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function optionText(opt: AssetOption, showAddress: boolean) {
  const base = opt.label?.trim() ? opt.label.trim() : opt.symbol;
  if (!showAddress) return base;
  return `${base} (${shortAddress(opt.address)})`;
}

export function AssetSelector(props: AssetSelectorProps) {
  const selectId = React.useId();
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
    className
  } = props;

  const selected = value ?? "";

  return (
    <Card className={className}>
      <div className="space-y-2 p-4">
        <div className="space-y-1">
          <Label htmlFor={selectId}>{title}</Label>
          {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
        </div>

        <select
          id={selectId}
          className={cn(
            "h-10 w-full rounded-md border border-border bg-surface-0 px-3 text-sm text-fg transition-colors duration-200",
            "focus:outline-none focus:ring-2 focus:ring-brand",
            "disabled:cursor-not-allowed disabled:border-border-soft disabled:text-fg-subtle",
            error ? "border-danger/50 focus:ring-danger/40" : "",
            disabled ? "opacity-70" : ""
          )}
          value={selected}
          disabled={disabled || assets.length === 0}
          onChange={(e) => {
            const next = e.target.value as `0x${string}`;
            if (!next) return;
            onValueChange?.(next);
          }}
        >
          <option value="">{assets.length === 0 ? "No assets" : placeholder}</option>
          {assets.map((a) => (
            <option key={a.address} value={a.address} disabled={a.disabled}>
              {optionText(a, showAddress)}
            </option>
          ))}
        </select>

        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
      </div>
    </Card>
  );
}

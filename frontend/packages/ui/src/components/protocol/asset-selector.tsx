"use client";

import * as React from "react";

import { Card } from "../ui/card";
import { Label } from "../ui/label";

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
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>

        <select
          id={selectId}
          className={[
            "h-10 w-full rounded-md border bg-background px-3 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            disabled ? "opacity-60" : ""
          ].join(" ")}
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

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </Card>
  );
}

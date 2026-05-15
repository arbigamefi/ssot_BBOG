import type { OpsStatusTone } from "./types";

export function shortHex(value?: string | null) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function toneTextClass(tone?: OpsStatusTone) {
  if (tone === "success") return "text-success";
  if (tone === "warn") return "text-warn";
  if (tone === "danger") return "text-danger";
  if (tone === "brand") return "text-brand";
  return "text-fg";
}

export function toneBadgeClass(tone?: OpsStatusTone) {
  if (tone === "success") return "border-success/30 bg-success-soft text-success";
  if (tone === "warn") return "border-warn/30 bg-warn-soft text-warn";
  if (tone === "danger") return "border-danger/30 bg-danger-soft text-danger";
  if (tone === "brand") return "border-brand/30 bg-brand-soft text-brand";
  return "border-border bg-surface-2 text-fg-muted";
}

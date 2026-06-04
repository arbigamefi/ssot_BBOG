import type { BetRow } from "@ssot/ssot/indexer";

const INVALID_VERSION_PATTERN = /\b(?:null|undefined)\b/i;
const ZERO_HASH = /^0x0+$/i;

type ReceiptVersionRow = Pick<BetRow, "lastEventName" | "lastTxHash" | "state" | "updatedAt">;

export function getReceiptOgVersion(row?: ReceiptVersionRow | null, fallbackVersion?: string) {
  if (row) {
    const version = normalizeReceiptOgVersion(
      [row.state, row.lastTxHash ?? "", row.lastEventName ?? "", row.updatedAt ?? ""]
        .filter(Boolean)
        .join(":")
    );
    if (version) return version;
  }

  return normalizeReceiptOgVersion(fallbackVersion) ?? "pending";
}

export function normalizeReceiptOgVersion(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (INVALID_VERSION_PATTERN.test(trimmed)) return undefined;
  if (ZERO_HASH.test(trimmed)) return undefined;
  return trimmed;
}

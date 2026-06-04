import type { BetRow } from "@ssot/ssot/indexer";

type Hex = `0x${string}`;

const INVALID_VERSION_PATTERN = /\b(?:null|undefined)\b/i;
const ZERO_HASH = /^0x0+$/i;

type ReceiptVersionRow = Pick<BetRow, "lastEventName" | "lastTxHash" | "state" | "updatedAt">;

export type ReceiptPreviewKind = "refunded" | "settled" | "won";

export type ReceiptPreviewHint = {
  amount: string;
  game: string;
  kind: ReceiptPreviewKind;
};

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

export function getReceiptPreviewHint({
  amount,
  game,
  kind
}: {
  amount?: string | null;
  game?: string | null;
  kind?: string | null;
}): ReceiptPreviewHint | undefined {
  const normalizedKind = normalizeReceiptPreviewKind(kind);
  const normalizedAmount = normalizeReceiptPreviewText(amount, 48);
  const normalizedGame = normalizeReceiptPreviewText(game, 32);
  if (!normalizedKind || !normalizedAmount || !normalizedGame) return undefined;
  return { amount: normalizedAmount, game: normalizedGame, kind: normalizedKind };
}

export function setReceiptPreviewParams(
  params: URLSearchParams,
  preview?: ReceiptPreviewHint | null
) {
  if (!preview) return;
  params.set("rt", preview.kind);
  params.set("ra", preview.amount);
  params.set("rg", preview.game);
}

export function getReceiptVersionTerminalTxHash(value?: string | null): Hex | undefined {
  const normalized = normalizeReceiptOgVersion(value);
  if (!normalized) return undefined;
  const match = normalized.match(/0x[a-fA-F0-9]{64}/);
  if (!match) return undefined;
  const hash = match[0] as Hex;
  return ZERO_HASH.test(hash) ? undefined : hash;
}

function normalizeReceiptPreviewKind(value?: string | null): ReceiptPreviewKind | undefined {
  if (value === "refunded" || value === "settled" || value === "won") return value;
  return undefined;
}

function normalizeReceiptPreviewText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  if (!trimmed || INVALID_VERSION_PATTERN.test(trimmed)) return undefined;
  return trimmed.slice(0, maxLength);
}

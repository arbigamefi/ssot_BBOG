import { getCasinoCashReturned } from "@ssot/bet-index/financials";
import type { BetRow } from "@ssot/ssot/indexer";

import { getExplorerTxUrl } from "../../app-shell/chain-registry";

/** What a printed receipt shows. Every amount is exact and pre-formatted; the receipt computes nothing. */
export type HomeReceipt = {
  betId: string;
  gameId?: string;
  href: string;
  placedBlock?: number;
  /** A win is stamped "Paid to wallet"; a loss is stamped "Settled". */
  stamp: "paid" | "settled";
  net: SignedAmount;
  /** Stake, won, house edge, paid to wallet, and unused stake when some came back. */
  lines: Array<{ key: "stake" | "won" | "houseEdge" | "paid" | "unused"; amount: string }>;
  requestId?: string;
  randomHash?: string;
  settledTx?: string;
  settledTxHref?: string;
};

export type SignedAmount = { sign: "+" | "−" | ""; whole: string; fraction: string };

function toBigInt(value?: string) {
  if (value == null || value === "") return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

/** Fraction digits needed to show `value` exactly. */
function fractionDigits(value: bigint, decimals: number) {
  const abs = value < 0n ? -value : value;
  let digits = decimals;
  while (digits > 0 && abs % 10n ** BigInt(decimals - digits + 1) === 0n) digits -= 1;
  return digits;
}

/** An amount cut to `digits` decimals (never rounded up), split at the decimal point. */
export function splitAmount(value: bigint, decimals: number, digits: number): SignedAmount {
  const abs = value < 0n ? -value : value;
  const base = 10n ** BigInt(decimals);
  const fraction = (abs % base).toString().padStart(decimals, "0").slice(0, digits);
  return {
    sign: value > 0n ? "+" : value < 0n ? "−" : "",
    whole: (abs / base).toLocaleString("en-US"),
    fraction
  };
}

function joined(amount: SignedAmount) {
  return amount.fraction ? `${amount.whole}.${amount.fraction}` : amount.whole;
}

/**
 * A settled bet as a receipt. All amounts on one receipt share one number of decimals (at least
 * two), so the decimal points line up and nothing is rounded. Bets that did not settle, or whose
 * payout split is not indexed, are not printed.
 */
export function buildHomeReceipt(
  row: BetRow,
  { chainId, decimals }: { chainId: number; decimals: number }
): HomeReceipt | null {
  if (row.state !== "finalized") return null;
  const stake = toBigInt(row.stake);
  const gross = toBigInt(row.payoutGross);
  const paid = toBigInt(row.payout);
  const returned = getCasinoCashReturned(row);
  if (stake == null || gross == null || paid == null || returned == null || paid > gross)
    return null;
  const unused = toBigInt(row.refundAmount) ?? 0n;
  const net = returned - stake;
  const values = [stake, gross, gross - paid, paid, unused, net];
  const digits = Math.max(2, ...values.map((value) => fractionDigits(value, decimals)));
  const amount = (value: bigint) => joined(splitAmount(value, decimals, digits));
  const settledTx = row.terminalTxHash ?? row.finalizedTxHash;
  return {
    betId: row.betId,
    gameId: row.gameId,
    href: `/casino/receipt/${chainId}/${row.betId}`,
    placedBlock: row.placedBlock,
    stamp: paid > 0n ? "paid" : "settled",
    net: splitAmount(net, decimals, digits),
    lines: [
      { key: "stake", amount: amount(stake) },
      { key: "won", amount: amount(gross) },
      { key: "houseEdge", amount: amount(gross - paid) },
      { key: "paid", amount: amount(paid) },
      ...(unused > 0n ? [{ key: "unused" as const, amount: amount(unused) }] : [])
    ],
    requestId: row.requestId,
    randomHash: row.randomHash,
    settledTx,
    settledTxHref: (settledTx && getExplorerTxUrl(chainId, settledTx)) || undefined
  };
}

/** `8657…5639` for a VRF request id, `0x1f63…1013` for a hash. */
export function shortId(value: string) {
  const head = value.startsWith("0x") ? 6 : 4;
  return value.length > head + 6 ? `${value.slice(0, head)}…${value.slice(-4)}` : value;
}

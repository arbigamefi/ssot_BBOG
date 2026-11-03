import { getCasinoFinancials } from "@ssot/bet-index/financials";
import type { PlayerPaymentProof } from "@ssot/bet-index/player-payment";
import type { CasinoOutcome } from "@ssot/ssot/domain";
import type { BetRow } from "@ssot/ssot/indexer";

import { getExplorerTxUrl } from "../../app-shell/chain-registry";
import type { CasinoTerminalRoundResult } from "../casino/room/resolution";
import { buildReceiptPath } from "./receipt-path";

// The receipt every bet prints, as data (docs/design/04-page-blueprints.md §1). The home page's
// printer, the dice slip and the receipt page all print it. Receipts are exact: every amount keeps
// the token's full decimals and nothing is rounded (02-voice-and-copy.md §6).

export type SignedAmount = { sign: "+" | "−" | ""; whole: string; fraction: string };

export type ReceiptLine = {
  key: "stake" | "won" | "houseEdge" | "paid" | "owed" | "unused" | "returned" | "claimable";
  amount: string;
};

/** What a printed receipt shows. Every amount is exact and pre-formatted; the receipt computes nothing. */
export type Receipt = {
  betId: string;
  href: string;
  /**
   * A win paid to the wallet is stamped "Paid to wallet"; a loss, or a payout held for the wallet, "Settled".
   * A refund and a void carry their own stamps.
   */
  stamp: "paid" | "settled" | "refunded" | "voided";
  /** The settlement held the payout for the wallet instead of transferring it. */
  owed: boolean;
  net: SignedAmount;
  /** Stake, won, house edge, paid or owed, and unused stake; stake and returned or claimable for a refund or void. */
  lines: ReceiptLine[];
  placedBlock?: number;
  requestId?: string;
  randomHash?: string;
  /** The transaction that settled, refunded or voided the bet. */
  settledTx?: string;
  settledTxHref?: string;
};

function toBigInt(value?: string) {
  if (value == null || value === "") return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

/** Fraction digits needed to show `value` exactly. */
export function fractionDigits(value: bigint, decimals: number) {
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

/** An amount as text, without its sign. */
export function joined(amount: SignedAmount) {
  return amount.fraction ? `${amount.whole}.${amount.fraction}` : amount.whole;
}

/** An amount exactly, with at least two decimals: `0.000012345678901234` for a fee in wei. */
export function exactAmount(value: bigint, decimals: number) {
  return joined(
    splitAmount(value, decimals, Math.min(decimals, Math.max(2, fractionDigits(value, decimals))))
  );
}

/** `8657…5639` for a VRF request id, `0x1f63…1013` for a hash. */
export function shortId(value: string) {
  const head = value.startsWith("0x") ? 6 : 4;
  return value.length > head + 6 ? `${value.slice(0, head)}…${value.slice(-4)}` : value;
}

type Printed = Pick<Receipt, "net" | "lines">;

/** All amounts on one receipt share one number of decimals (at least two), so the points line up. */
function print(
  values: Array<{ key: ReceiptLine["key"]; value: bigint }>,
  net: bigint,
  decimals: number
): Printed {
  const digits = Math.max(
    2,
    ...[...values.map((line) => line.value), net].map((value) => fractionDigits(value, decimals))
  );
  return {
    net: splitAmount(net, decimals, digits),
    lines: values.map((line) => ({
      key: line.key,
      amount: joined(splitAmount(line.value, decimals, digits))
    }))
  };
}

/** A settlement: stake, won, the house edge taken from it, what was paid or is owed, and unused stake. */
function printSettlement(
  {
    stake,
    gross,
    paid,
    unused,
    owed
  }: {
    stake: bigint;
    gross: bigint;
    paid: bigint;
    unused: bigint;
    owed: boolean;
  },
  decimals: number
): Pick<Receipt, "stamp" | "owed" | "net" | "lines"> {
  return {
    stamp: paid > 0n && !owed ? "paid" : "settled",
    owed,
    ...print(
      [
        { key: "stake", value: stake },
        { key: "won", value: gross },
        { key: "houseEdge", value: gross - paid },
        { key: owed ? "owed" : "paid", value: paid },
        ...(unused > 0n ? [{ key: "unused" as const, value: unused }] : [])
      ],
      paid + unused - stake,
      decimals
    )
  };
}

/** A refund or a void: the stake, and what came back to the wallet or became a claimable balance. */
function printReturn(
  kind: "refunded" | "voided",
  { stake, returned }: { stake: bigint; returned: bigint },
  decimals: number
): Pick<Receipt, "stamp" | "owed" | "net" | "lines"> {
  return {
    stamp: kind,
    owed: false,
    ...print(
      [
        { key: "stake", value: stake },
        { key: kind === "voided" ? "claimable" : "returned", value: returned }
      ],
      returned - stake,
      decimals
    )
  };
}

/**
 * A settled, refunded or voided bet of the bet index as its receipt. `payment` is the terminal
 * transaction's evidence when it was read: a payout it held for the wallet prints as owed. Bets
 * that did not finish, or whose amounts are not all indexed, are not printed.
 */
export function receiptFromRow(
  row: BetRow,
  {
    chainId,
    decimals,
    payment
  }: { chainId: number; decimals: number; payment?: PlayerPaymentProof }
): Receipt | null {
  const financials = getCasinoFinancials(row);
  if (!financials) return null;
  const settledTx =
    row.terminalTxHash ?? row.finalizedTxHash ?? row.refundedTxHash ?? row.voidedTxHash;
  const base = {
    betId: row.betId,
    href: buildReceiptPath({ betId: row.betId, chainId, gameHub: row.gameHub }),
    placedBlock: row.placedBlock,
    requestId: row.requestId,
    randomHash: row.randomHash,
    settledTx,
    settledTxHref: (settledTx && getExplorerTxUrl(chainId, settledTx)) || undefined
  };
  if (row.state === "finalized") {
    const gross = toBigInt(row.payoutGross);
    if (gross == null || financials.award > gross) return null;
    // Evidence for another amount proves nothing about this one.
    const owed = payment?.status === "payable" && payment.amount === financials.returned.toString();
    return {
      ...base,
      ...printSettlement(
        {
          stake: financials.stake,
          gross,
          paid: financials.award,
          unused: financials.refund,
          owed
        },
        decimals
      )
    };
  }
  return {
    ...base,
    ...printReturn(
      row.state === "voided" ? "voided" : "refunded",
      { stake: financials.stake, returned: financials.refund },
      decimals
    )
  };
}

/** A bet the room just watched settle, refund or void, as its receipt. */
export function receiptFromResult(
  result: CasinoTerminalRoundResult,
  outcome: CasinoOutcome | null | undefined,
  { chainId, decimals, gameHub }: { chainId: number; decimals: number; gameHub?: string }
): Receipt {
  const settledTx = result.kind === "settled" ? result.settlement.txHash : result.refund.txHash;
  const base = {
    betId: result.betId.toString(),
    href: buildReceiptPath({ betId: result.betId, chainId, gameHub }),
    requestId: result.requestId.toString(),
    randomHash: result.randomHash,
    settledTx,
    settledTxHref: (settledTx && getExplorerTxUrl(chainId, settledTx)) || undefined
  };

  if (result.kind === "settled") {
    const { settlement } = result;
    const paid = settlement.payoutNet;
    const gross =
      settlement.payoutGross ?? outcome?.payoutGross ?? paid + (settlement.feeOnPayout ?? 0n);
    return {
      ...base,
      ...printSettlement(
        {
          stake: result.stake,
          gross,
          paid,
          unused: settlement.refundAmount,
          owed: settlement.payment?.status === "payable"
        },
        decimals
      )
    };
  }
  return {
    ...base,
    ...printReturn(
      result.kind,
      { stake: result.stake, returned: result.refund.refundAmount },
      decimals
    )
  };
}

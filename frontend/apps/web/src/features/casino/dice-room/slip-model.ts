import type { CasinoAccess } from "../../../app-shell/casino-access";
import { fractionDigits, joined, splitAmount, type SignedAmount } from "../../home/receipts";
import type { PoolAvailability } from "../room/hooks";
import type { CasinoOutcome } from "../room/outcome";
import type { DiceDirection } from "../room/payouts";
import type { CasinoTerminalRoundResult } from "../room/resolution";

// The dice room's slip, as data: the odds it quotes, the one action its main button takes and the
// receipt it prints. Quotes round down; receipts are exact (docs/design/02-voice-and-copy.md §6).

/** Winning numbers out of 100: low wins on 1..line, high on line+1..100. */
export function diceWins(direction: DiceDirection, line: number) {
  return direction === "under" ? line : 100 - line;
}

export function diceWinRange(direction: DiceDirection, line: number): readonly [number, number] {
  return direction === "under" ? [1, line] : [line + 1, 100];
}

export function diceLoseRange(direction: DiceDirection, line: number): readonly [number, number] {
  return direction === "under" ? [line + 1, 100] : [1, line];
}

/** One winning round's payout, as DiceModule and GameHub compute it: the gross payout less the house edge. */
export function dicePayout(perRound: bigint, wins: number, houseEdgeBps: number) {
  if (wins <= 0) return 0n;
  const gross = (perRound * 100n) / BigInt(wins);
  return gross - (gross * BigInt(houseEdgeBps)) / 10_000n;
}

/** What one unit pays on a win, cut to two decimals. A multiplier carries no sign. */
export function diceMultiplier(wins: number, houseEdgeBps: number): SignedAmount {
  return { ...splitAmount(dicePayout(1_000_000n, wins, houseEdgeBps), 6, 2), sign: "" };
}

/**
 * An amount on the quote's grid: two decimals from one unit, four below it. What the player can
 * receive or is offered is cut (`down`); what the player must pay at least, such as the minimum
 * stake, is rounded `up`, so the stake it sets is never under the minimum.
 */
export function quoteRaw(raw: bigint, decimals: number, round: "down" | "up" = "down") {
  const keep = raw >= 10n ** BigInt(decimals) ? 2 : 4;
  if (decimals <= keep) return raw;
  const step = 10n ** BigInt(decimals - keep);
  const cut = (raw / step) * step;
  return round === "up" && cut < raw ? cut + step : cut;
}

/** A quoted amount for reading: `1.06`, `0.0304`, `1,250.00`. */
export function formatQuote(raw: bigint, decimals: number) {
  const cut = quoteRaw(raw, decimals);
  return joined(
    splitAmount(cut, decimals, Math.min(decimals, Math.max(2, fractionDigits(cut, decimals))))
  );
}

/**
 * A stake the slip sets, exact: what the field holds is what the wallet signs. At least two
 * decimals, as many more as the amount has.
 */
export function formatStake(raw: bigint, decimals: number) {
  return joined(
    splitAmount(raw, decimals, Math.min(decimals, Math.max(2, fractionDigits(raw, decimals))))
  );
}

/** The same stake for the field: no grouping. */
export function stakeText(raw: bigint, decimals: number) {
  return formatStake(raw, decimals).replace(/,/g, "");
}

export type SlipNotice =
  | { kind: "preview" }
  | { kind: "network" }
  | { kind: "pool"; status: Exclude<PoolAvailability, "ready"> }
  | { kind: "min"; min: bigint }
  | { kind: "overMax"; max: bigint }
  | { kind: "noCapacity" }
  | { kind: "balance"; balance: bigint }
  | { kind: "error"; error: string };

export type SlipAction =
  | { kind: "telegram" }
  | { kind: "connect" }
  | { kind: "switchNetwork" }
  | { kind: "signing"; step: "prepare" | "one" | "allow" | "bet" }
  | { kind: "poolLoading" }
  | { kind: "checkAgain" }
  | { kind: "setStake"; to: bigint; why: "min" | "overMax" | "balance" }
  | { kind: "faucet"; asset: "usdc" | "eth" }
  | { kind: "blocked"; why: "noCapacity" | "balance" | "unconfirmed" }
  | { kind: "checkTransaction" }
  | { kind: "place"; approval: boolean };

export type SlipQuote = { action: SlipAction; notice?: SlipNotice };

export type SlipQuoteInput = {
  access: CasinoAccess;
  hasAccount: boolean;
  wrongNetwork: boolean;
  /** The bet stepper: idle, planning, submitting, mined, reconciled or failed. */
  status: string;
  executionStage?: "approve" | "placeBet";
  needsApproval?: boolean;
  /** `getBetErrorKind` of the stepper's error, when it failed. */
  errorKind?: string;
  canCheckTransaction: boolean;
  poolAvailability: PoolAvailability;
  perRound: bigint;
  rounds: number;
  minPerRound: bigint;
  /** The most the house pool takes per round at these odds; unknown until the pool is read. */
  poolMaxPerRound?: bigint;
  /** The wallet's balance; unknown until it is read. */
  balance?: bigint | null;
  decimals: number;
};

/**
 * The main button keeps one place in every state. When one action fixes what is wrong it becomes
 * that action, and the reason sits above it.
 */
export function deriveSlipQuote(input: SlipQuoteInput): SlipQuote {
  const { errorKind } = input;
  if (input.access === "preview")
    return { action: { kind: "telegram" }, notice: { kind: "preview" } };
  if (!input.hasAccount) return { action: { kind: "connect" } };
  if (input.wrongNetwork || errorKind === "network")
    return { action: { kind: "switchNetwork" }, notice: { kind: "network" } };
  if (input.status === "planning") return { action: { kind: "signing", step: "prepare" } };
  if (input.status === "submitting") {
    const step =
      input.executionStage === "approve"
        ? "allow"
        : input.executionStage === "placeBet" && input.needsApproval
          ? "bet"
          : "one";
    return { action: { kind: "signing", step } };
  }
  if (errorKind === "unconfirmed")
    return {
      action: input.canCheckTransaction
        ? { kind: "checkTransaction" }
        : { kind: "blocked", why: "unconfirmed" },
      notice: { kind: "error", error: errorKind }
    };
  if (input.poolAvailability === "loading") return { action: { kind: "poolLoading" } };
  if (input.poolAvailability !== "ready")
    return {
      action: { kind: "checkAgain" },
      notice: { kind: "pool", status: input.poolAvailability }
    };

  const rounds = BigInt(Math.max(1, Math.floor(input.rounds)));
  const poolMax = input.poolMaxPerRound;
  if (poolMax != null && (poolMax === 0n || poolMax < input.minPerRound))
    return { action: { kind: "blocked", why: "noCapacity" }, notice: { kind: "noCapacity" } };
  if (input.perRound < input.minPerRound) {
    const min = quoteRaw(input.minPerRound, input.decimals, "up");
    return {
      action: { kind: "setStake", to: min, why: "min" },
      notice: { kind: "min", min }
    };
  }
  if (poolMax != null && input.perRound > poolMax) {
    // Cut to the quote, unless the cut falls under the minimum: then the exact limit.
    const cut = quoteRaw(poolMax, input.decimals);
    const max = cut >= input.minPerRound ? cut : poolMax;
    return {
      action: { kind: "setStake", to: max, why: "overMax" },
      notice: { kind: "overMax", max }
    };
  }
  if (input.balance != null && input.perRound * rounds > input.balance) {
    const left = quoteRaw(input.balance / rounds, input.decimals);
    const notice = { kind: "balance", balance: input.balance } as const;
    if (left >= input.minPerRound && left > 0n)
      return { action: { kind: "setStake", to: left, why: "balance" }, notice };
    return {
      action:
        input.access === "testnet"
          ? { kind: "faucet", asset: "usdc" }
          : { kind: "blocked", why: "balance" },
      notice
    };
  }
  const place = { kind: "place", approval: Boolean(input.needsApproval) } as const;
  if (errorKind === "gas")
    return {
      action: input.access === "testnet" ? { kind: "faucet", asset: "eth" } : place,
      notice: { kind: "error", error: errorKind }
    };
  if (errorKind) return { action: place, notice: { kind: "error", error: errorKind } };
  return { action: place };
}

/**
 * "Max": the most the house pool takes per round at these odds and the balance shared across the
 * rounds, whichever is lower, cut to the quote's decimals. Unknown until either is read. Below the
 * minimum it stays below it, so the slip says why nothing can be staked.
 */
export function slipMaxStake({
  poolMaxPerRound,
  balance,
  rounds,
  decimals
}: {
  poolMaxPerRound?: bigint;
  balance?: bigint | null;
  rounds: number;
  decimals: number;
}) {
  const caps = [
    poolMaxPerRound,
    balance == null ? undefined : balance / BigInt(Math.max(1, rounds))
  ];
  const known = caps.filter((cap): cap is bigint => cap != null);
  if (known.length === 0) return undefined;
  const cap = known.reduce((low, cap) => (cap < low ? cap : low));
  return quoteRaw(cap, decimals);
}

export type SlipReceiptLine = {
  key: "stake" | "won" | "houseEdge" | "paid" | "owed" | "unused" | "returned" | "claimable";
  amount: string;
};

export type SlipReceipt = {
  betId: string;
  stamp: "paid" | "settled" | "refunded" | "voided";
  /** The settlement held the payout for the wallet instead of transferring it. */
  owed: boolean;
  net: SignedAmount;
  lines: SlipReceiptLine[];
  requestId: string;
  randomHash: string;
  settledTx?: string;
  vrfFeeCharged?: bigint;
};

/** A settled, refunded or voided dice bet as its receipt: exact amounts, one number of decimals. */
export function buildSlipReceipt(
  result: CasinoTerminalRoundResult,
  outcome: CasinoOutcome | null | undefined,
  decimals: number
): SlipReceipt {
  const base = {
    betId: result.betId.toString(),
    requestId: result.requestId.toString(),
    randomHash: result.randomHash,
    vrfFeeCharged: result.vrfFeeCharged
  };
  const print = (values: Array<{ key: SlipReceiptLine["key"]; value: bigint }>, net: bigint) => {
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
  };

  if (result.kind === "settled") {
    const { settlement } = result;
    const paid = settlement.payoutNet;
    const unused = settlement.refundAmount;
    const gross =
      settlement.payoutGross ??
      (outcome?.kind === "dice" ? outcome.payoutGross : paid + (settlement.feeOnPayout ?? 0n));
    const edge = settlement.feeOnPayout ?? gross - paid;
    const owed = settlement.payment?.status === "payable";
    return {
      ...base,
      settledTx: settlement.txHash,
      stamp: paid > 0n && !owed ? "paid" : "settled",
      owed,
      ...print(
        [
          { key: "stake", value: result.stake },
          { key: "won", value: gross },
          { key: "houseEdge", value: edge },
          { key: owed ? "owed" : "paid", value: paid },
          ...(unused > 0n ? [{ key: "unused" as const, value: unused }] : [])
        ],
        paid + unused - result.stake
      )
    };
  }

  const returned = result.refund.refundAmount;
  return {
    ...base,
    settledTx: result.refund.txHash,
    stamp: result.kind === "voided" ? "voided" : "refunded",
    owed: false,
    ...print(
      [
        { key: "stake", value: result.stake },
        { key: result.kind === "voided" ? "claimable" : "returned", value: returned }
      ],
      returned - result.stake
    )
  };
}

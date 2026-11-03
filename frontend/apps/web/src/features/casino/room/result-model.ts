import type { PlayerPaymentProof } from "@ssot/bet-index/player-payment";

import { getExplorerTxUrl } from "../../../app-shell/chain-registry";
import type { CasinoTerminalRoundResult } from "./resolution";
import { formatUnits } from "../../betting/model/units";

/** A voided bet returned its stake as a claimable balance (ADR-0037 §7); nothing was paid out. */
export type CasinoReceiptState = "finalized" | "refunded" | "voided";
export type CasinoReceiptTone = "win" | "loss" | "neutral";

export type CasinoReceiptViewModel = {
  assetAddress?: string;
  assetDecimals: number;
  assetSymbol: string;
  betId: string;
  chainId?: number;
  gameId?: string;
  gameLabel: string;
  gameSlug?: string;
  lastEventName?: string;
  multiplierValue: string;
  net: bigint;
  netValue: string;
  payout: bigint;
  payoutValue: string;
  payment: PlayerPaymentProof;
  placedBlock?: number;
  player?: string;
  referrerL1?: string;
  referrerL2?: string;
  randomHash?: string;
  requestId?: string;
  resolvedAt?: number;
  shareText: string;
  signedNetValue: string;
  stake: bigint;
  stakeValue: string;
  state: CasinoReceiptState;
  terminalTxHash?: string;
  tone: CasinoReceiptTone;
  txHref?: string;
  updatedAt?: number;
};

export function buildCasinoReceiptFromTerminalResult({
  assetDecimals,
  assetSymbol,
  chainId,
  gameLabel,
  gameSlug,
  result
}: {
  assetDecimals: number;
  assetSymbol: string;
  chainId?: number;
  gameLabel: string;
  gameSlug?: string;
  result: CasinoTerminalRoundResult;
}): CasinoReceiptViewModel {
  const state: CasinoReceiptState = result.kind === "settled" ? "finalized" : result.kind;
  const payout =
    result.kind === "settled"
      ? result.settlement.payoutNet + result.settlement.refundAmount
      : result.refund.refundAmount;
  const terminalTxHash =
    result.kind === "settled" ? result.settlement.txHash : result.refund.txHash;
  return buildCasinoReceiptViewModel({
    assetDecimals,
    assetSymbol,
    betId: result.betId.toString(),
    chainId,
    gameLabel,
    gameSlug,
    player: result.player,
    randomHash: result.randomHash,
    requestId: result.requestId.toString(),
    resolvedAt: result.resolvedAt,
    stake: result.stake,
    state,
    terminalTxHash,
    payout,
    payment: result.kind === "settled" ? result.settlement.payment : result.refund.payment
  });
}

export function formatReceiptTokenAmount(
  value: bigint | undefined,
  decimals: number,
  symbol?: string,
  maxFractionDigits = 4,
  emptyLabel = "—"
) {
  if (value == null) return emptyLabel;
  const raw = formatUnits(value, decimals);
  const negative = raw.startsWith("-");
  const normalized = negative ? raw.slice(1) : raw;
  const [intPart = "0", fracPart = ""] = normalized.split(".");
  const integer = BigInt(intPart || "0").toLocaleString("en-US");
  const fraction = fracPart.slice(0, maxFractionDigits).replace(/0+$/, "");
  const body = `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
  return symbol ? `${body} ${symbol}` : body;
}

export function formatSignedReceiptTokenAmount(value: bigint, decimals: number, symbol: string) {
  const body = formatReceiptTokenAmount(value < 0n ? -value : value, decimals, symbol, decimals);
  if (value > 0n) return `+ ${body}`;
  if (value < 0n) return `- ${body}`;
  return body;
}

export function formatReceiptMultiplier(payout: bigint, stake: bigint) {
  if (stake <= 0n) return "—";
  const scaled = (payout * 100n) / stake;
  const whole = scaled / 100n;
  const fraction = String(scaled % 100n).padStart(2, "0");
  return `${whole}.${fraction}x`;
}

function buildCasinoReceiptViewModel({
  assetAddress,
  assetDecimals,
  assetSymbol,
  betId,
  chainId,
  gameId,
  gameLabel,
  gameSlug,
  lastEventName,
  placedBlock,
  player,
  referrerL1,
  referrerL2,
  randomHash,
  requestId,
  resolvedAt,
  stake,
  state,
  terminalTxHash,
  payout,
  payment,
  updatedAt
}: {
  assetAddress?: string;
  assetDecimals: number;
  assetSymbol: string;
  betId: string;
  chainId?: number;
  gameId?: string;
  gameLabel: string;
  gameSlug?: string;
  lastEventName?: string;
  placedBlock?: number;
  player?: string;
  referrerL1?: string;
  referrerL2?: string;
  randomHash?: string;
  requestId?: string;
  resolvedAt?: number;
  stake: bigint;
  state: CasinoReceiptState;
  terminalTxHash?: string;
  payout: bigint;
  payment?: PlayerPaymentProof;
  updatedAt?: number;
}): CasinoReceiptViewModel {
  const net = payout - stake;
  const tone = state === "finalized" ? toneFromNet(net) : "neutral";
  const signedNetValue = formatSignedReceiptTokenAmount(net, assetDecimals, assetSymbol);
  const txHref = getExplorerTxUrl(chainId, terminalTxHash) ?? undefined;
  const provenPayment: PlayerPaymentProof =
    payout === 0n
      ? { status: "none", amount: "0" }
      : payment?.amount === payout.toString() && ["transferred", "payable"].includes(payment.status)
        ? payment
        : { status: "unknown", amount: payout.toString() };
  return {
    assetAddress,
    assetDecimals,
    assetSymbol,
    betId,
    chainId,
    gameId,
    gameLabel,
    gameSlug,
    lastEventName,
    multiplierValue: formatReceiptMultiplier(payout, stake),
    net,
    netValue: formatReceiptTokenAmount(net, assetDecimals, assetSymbol, assetDecimals),
    payout,
    payoutValue: formatReceiptTokenAmount(payout, assetDecimals, assetSymbol, assetDecimals),
    payment: provenPayment,
    placedBlock,
    player,
    referrerL1,
    referrerL2,
    randomHash,
    requestId,
    resolvedAt,
    shareText: `${gameLabel} bet #${betId}: ${signedNetValue}`,
    signedNetValue,
    stake,
    stakeValue: formatReceiptTokenAmount(stake, assetDecimals, assetSymbol, assetDecimals),
    state,
    terminalTxHash,
    tone,
    txHref,
    updatedAt
  };
}

function toneFromNet(value: bigint): CasinoReceiptTone {
  if (value > 0n) return "win";
  if (value < 0n) return "loss";
  return "neutral";
}

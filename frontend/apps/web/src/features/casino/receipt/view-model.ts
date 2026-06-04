import type { BetRow } from "@ssot/ssot/indexer";

import { getExplorerTxUrl } from "../../../app-shell/chain-registry";
import type { CasinoTerminalRoundResult } from "../room/resolution";
import { formatUnits } from "../../betting/model/units";

export type CasinoReceiptState = "finalized" | "refunded";
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
  placedBlock?: number;
  player?: string;
  pricingAffiliate?: string;
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
  const state: CasinoReceiptState = result.kind === "refunded" ? "refunded" : "finalized";
  const payout =
    result.kind === "refunded" ? result.refund.refundAmount : result.settlement.payoutNet;
  const terminalTxHash =
    result.kind === "refunded" ? result.refund.txHash : result.settlement.txHash;
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
    payout
  });
}

export function buildCasinoReceiptFromBetRow({
  assetDecimals,
  assetSymbol,
  chainId,
  gameLabel,
  gameSlug,
  row
}: {
  assetDecimals: number;
  assetSymbol: string;
  chainId: number;
  gameLabel: string;
  gameSlug?: string;
  row: BetRow;
}): CasinoReceiptViewModel {
  const state: CasinoReceiptState = row.state === "refunded" ? "refunded" : "finalized";
  return buildCasinoReceiptViewModel({
    assetAddress: row.asset,
    assetDecimals,
    assetSymbol,
    betId: row.betId,
    chainId,
    gameId: row.gameId,
    gameLabel,
    gameSlug,
    lastEventName: row.lastEventName,
    placedBlock: row.placedBlock,
    player: row.player,
    pricingAffiliate: row.pricingAffiliate,
    randomHash: row.randomHash,
    requestId: row.requestId,
    resolvedAt: row.updatedAt,
    stake: bigintFromString(row.stake) ?? 0n,
    state,
    terminalTxHash:
      row.terminalTxHash ?? row.finalizedTxHash ?? row.refundedTxHash ?? row.lastTxHash,
    payout: getRowPayout(row),
    updatedAt: row.updatedAt
  });
}

export function buildCasinoReceiptProofText({
  assetLabel,
  lastTx,
  model,
  status
}: {
  assetLabel?: string;
  lastTx: string;
  model: CasinoReceiptViewModel;
  status: string;
}) {
  return [
    `ArbiGameFi casino receipt #${model.betId}`,
    `Status: ${status}`,
    `Game: ${model.gameLabel}`,
    `Asset: ${assetLabel ?? model.assetSymbol}`,
    `Stake: ${model.stakeValue}`,
    `Payout: ${model.payoutValue}`,
    `Net: ${model.netValue}`,
    `Chain ID: ${model.chainId ?? "—"}`,
    `Player: ${model.player ?? "—"}`,
    `VRF request: ${model.requestId ?? "—"}`,
    `Random hash: ${model.randomHash ?? "—"}`,
    `Transaction: ${lastTx}`
  ].join("\n");
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
  const body = formatReceiptTokenAmount(value < 0n ? -value : value, decimals, symbol);
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
  pricingAffiliate,
  randomHash,
  requestId,
  resolvedAt,
  stake,
  state,
  terminalTxHash,
  payout,
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
  pricingAffiliate?: string;
  randomHash?: string;
  requestId?: string;
  resolvedAt?: number;
  stake: bigint;
  state: CasinoReceiptState;
  terminalTxHash?: string;
  payout: bigint;
  updatedAt?: number;
}): CasinoReceiptViewModel {
  const net = payout - stake;
  const tone = state === "finalized" ? toneFromNet(net) : "neutral";
  const signedNetValue = formatSignedReceiptTokenAmount(net, assetDecimals, assetSymbol);
  const txHref = getExplorerTxUrl(chainId, terminalTxHash) ?? undefined;
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
    netValue: formatReceiptTokenAmount(net, assetDecimals, assetSymbol),
    payout,
    payoutValue: formatReceiptTokenAmount(payout, assetDecimals, assetSymbol),
    placedBlock,
    player,
    pricingAffiliate,
    randomHash,
    requestId,
    resolvedAt,
    shareText: `${gameLabel} bet #${betId}: ${signedNetValue}`,
    signedNetValue,
    stake,
    stakeValue: formatReceiptTokenAmount(stake, assetDecimals, assetSymbol),
    state,
    terminalTxHash,
    tone,
    txHref,
    updatedAt
  };
}

function getRowPayout(row: BetRow) {
  if (row.state === "refunded") return bigintFromString(row.refundAmount) ?? 0n;
  return bigintFromString(row.payout) ?? 0n;
}

function bigintFromString(value?: string) {
  return value == null || value === "" ? undefined : BigInt(value);
}

function toneFromNet(value: bigint): CasinoReceiptTone {
  if (value > 0n) return "win";
  if (value < 0n) return "loss";
  return "neutral";
}

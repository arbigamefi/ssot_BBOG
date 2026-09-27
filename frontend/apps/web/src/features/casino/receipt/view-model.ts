import { getCasinoCashReturned } from "@ssot/bet-index/financials";
import type { BetRow } from "@ssot/ssot/indexer";

import { getExplorerTxUrl } from "../../../app-shell/chain-registry";
import type { CasinoTerminalRoundResult } from "../room/resolution";
import { formatUnits } from "../../betting/model/units";

export type CasinoReceiptState = "finalized" | "refunded";
export type CasinoReceiptTone = "win" | "loss" | "neutral";

/** Where a settled bet's house edge went (v1.6), formatted in the bet's asset. */
export type CasinoReceiptHouseEdge = {
  edgeValue: string;
  /** The effective edge as a percentage, e.g. "2.00%". */
  rateLabel: string;
  turnoverValue: string;
  lpRetainedValue: string;
  protocolFeeValue: string;
  /** Player rakeback (L0); absent when zero. */
  playerRakebackValue?: string;
  /** Both referral levels (L1 + L2); absent when zero. */
  referrersValue?: string;
  /** The referrer's markup share; absent when zero. */
  affiliateMarkupValue?: string;
};

export type CasinoReceiptViewModel = {
  assetAddress?: string;
  assetDecimals: number;
  assetSymbol: string;
  betId: string;
  chainId?: number;
  gameId?: string;
  gameLabel: string;
  gameSlug?: string;
  houseEdge?: CasinoReceiptHouseEdge;
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
    result.kind === "refunded"
      ? result.refund.refundAmount
      : result.settlement.payoutNet + result.settlement.refundAmount;
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
  const model = buildCasinoReceiptViewModel({
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
  const houseEdge = row.houseEdge
    ? buildReceiptHouseEdge(row.houseEdge, assetDecimals, assetSymbol)
    : undefined;
  return houseEdge ? { ...model, houseEdge } : model;
}

function buildReceiptHouseEdge(
  allocation: NonNullable<BetRow["houseEdge"]>,
  decimals: number,
  symbol: string
): CasinoReceiptHouseEdge | undefined {
  const amount = (key: Exclude<keyof typeof allocation, "effectiveHouseEdgeBps">) =>
    bigintFromString(allocation[key]);
  const edge = amount("edge");
  const turnover = amount("usedTurnover");
  const lpRetained = amount("lpRetained");
  const protocolFee = amount("protocolFee");
  const r0 = amount("r0");
  const r1 = amount("r1");
  const r2 = amount("r2");
  const markup = amount("markup");
  if ([edge, turnover, lpRetained, protocolFee, r0, r1, r2, markup].some((v) => v == null)) {
    return undefined;
  }
  // Small bets in an 18-decimal asset would round their shares to 0 at the usual 4 digits.
  const format = (value: bigint) =>
    formatReceiptTokenAmount(value, decimals, symbol, Math.min(decimals, 8));
  const optional = (value: bigint) => (value > 0n ? format(value) : undefined);
  const bps = allocation.effectiveHouseEdgeBps;
  return {
    edgeValue: format(edge!),
    rateLabel: `${Math.floor(bps / 100)}.${String(bps % 100).padStart(2, "0")}%`,
    turnoverValue: format(turnover!),
    lpRetainedValue: format(lpRetained!),
    protocolFeeValue: format(protocolFee!),
    playerRakebackValue: optional(r0!),
    referrersValue: optional(r1! + r2!),
    affiliateMarkupValue: optional(markup!)
  };
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
    ...(model.houseEdge
      ? [
          `House edge: ${model.houseEdge.edgeValue} (${model.houseEdge.rateLabel} of ${model.houseEdge.turnoverValue})`,
          `Kept by LPs: ${model.houseEdge.lpRetainedValue}`,
          ...(model.houseEdge.playerRakebackValue
            ? [`Player rakeback: ${model.houseEdge.playerRakebackValue}`]
            : []),
          ...(model.houseEdge.referrersValue
            ? [`Referrers: ${model.houseEdge.referrersValue}`]
            : []),
          ...(model.houseEdge.affiliateMarkupValue
            ? [`Referrer markup: ${model.houseEdge.affiliateMarkupValue}`]
            : []),
          `Protocol fee: ${model.houseEdge.protocolFeeValue}`
        ]
      : []),
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
  const returned = getCasinoCashReturned(row);
  if (returned == null) throw new Error("Casino receipt financials are not ready");
  return returned;
}

function bigintFromString(value?: string) {
  return value == null || value === "" ? undefined : BigInt(value);
}

function toneFromNet(value: bigint): CasinoReceiptTone {
  if (value > 0n) return "win";
  if (value < 0n) return "loss";
  return "neutral";
}

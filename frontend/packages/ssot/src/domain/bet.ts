export type BetState = "placed" | "randomReady" | "finalized" | "refunded";

export interface DomainBet {
  betId: bigint;
  chainId: number;
  gameId: `0x${string}`;
  asset: `0x${string}`;
  bank: `0x${string}`;
  player: `0x${string}`;
  stake: bigint;
  reserved: bigint;
  amountPerRoll: bigint;
  betCount: number;
  stopGain: bigint;
  stopLoss: bigint;
  effectiveHouseEdgeBps: number;
  vrfFeePaid: bigint;
  vrfFeeCharged: bigint;
  vrfCallbackGasLimit: number;
  requestId: bigint;
  randomHash: `0x${string}`;
  state: BetState;
  placedAt: number;
  vrfRequestedAt?: number;
  resolvedAt?: number;
  settledAt?: number;
  payout?: bigint;
  refund?: bigint;
}

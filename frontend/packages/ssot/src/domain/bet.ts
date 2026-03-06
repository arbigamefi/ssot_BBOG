export type BetState = "placed" | "randomReady" | "finalized" | "refunded";

export interface DomainBet {
  betId: bigint;
  chainId: number;
  gameId: `0x${string}`;
  asset: `0x${string}`;
  player: `0x${string}`;
  stake: bigint;
  vrfFeePaid: bigint;
  state: BetState;
  placedAt: number;
  settledAt?: number;
  payout?: bigint;
  refund?: bigint;
}

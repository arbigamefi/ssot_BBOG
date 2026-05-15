export type SportsMarketState =
  | "none"
  | "draft"
  | "open"
  | "locked"
  | "suspended"
  | "resultProposed"
  | "challenged"
  | "resolved"
  | "voided";

export type SportsTicketState = "none" | "held" | "settled" | "refunded" | "voided";

export type SportsChallengeDecision = "none" | "upholdResult" | "reopenResult" | "voidMarket";

export interface DomainSportsMarket {
  marketId: bigint;
  eventId: bigint;
  poolId: number;
  outcomeCount: number;
  startsAt: number;
  lockTime: number;
  resultFinalitySeconds: number;
  version: bigint;
  marketKey: `0x${string}`;
  rulebookHash: `0x${string}`;
  state: SportsMarketState;
}

export interface DomainSportsTicket {
  ticketId: bigint;
  positionId: bigint;
  marketId: bigint;
  eventId: bigint;
  poolId: number;
  outcomeId: number;
  player: `0x${string}`;
  stake: bigint;
  payout: bigint;
  reserved: bigint;
  oddsSnapshotHash: `0x${string}`;
  rulebookHash: `0x${string}`;
  acceptedAt: number;
  state: SportsTicketState;
}

export interface DomainSportsResult {
  marketId: bigint;
  eventId: bigint;
  poolId: number;
  winningOutcomeId: number;
  marketVersion: bigint;
  resultPayloadHash: `0x${string}`;
  resultSourceHash: `0x${string}`;
  evidenceHash: `0x${string}`;
  rulebookHash: `0x${string}`;
  reporterSetHash: `0x${string}`;
  reporterThreshold: number;
  reporterCount: number;
  proposer: `0x${string}`;
  observedAt: number;
  proposedAt: number;
  finalizesAt: number;
  challenged: boolean;
  challengeReasonHash: `0x${string}`;
  challenger: `0x${string}`;
  challengedAt: number;
  challengeDecision: SportsChallengeDecision;
  arbitrationDecisionHash: `0x${string}`;
  arbitrator: `0x${string}`;
  arbitratedAt: number;
}

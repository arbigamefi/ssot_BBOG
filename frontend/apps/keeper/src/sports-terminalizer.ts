import type { Hex } from "viem";
import { describeError } from "./errors.js";
import type { KeeperLogger } from "./types.js";

export type SportsMarketStateName =
  | "none"
  | "draft"
  | "open"
  | "locked"
  | "suspended"
  | "resultProposed"
  | "challenged"
  | "resolved"
  | "voided";

export type SportsTicketStateName = "none" | "held" | "settled" | "refunded" | "voided";

export type SportsMarketRead = {
  marketId: bigint;
  state: SportsMarketStateName;
};

export type SportsResultRead = {
  marketId: bigint;
  challenged: boolean;
  finalizesAt: number;
};

export type SportsTicketRead = {
  ticketId: bigint;
  state: SportsTicketStateName;
};

export type SportsTerminalizeOutcome =
  | {
      kind: "terminalized";
      finalizeTxHash?: Hex;
      latencyMs: number;
      marketState: "resolved" | "voided";
      refunded: number;
      settled: number;
      skipped: number;
    }
  | {
      kind: "skipped";
      finalizesAt?: number;
      reason:
        | "challenge-pending"
        | "finality-pending"
        | "market-not-terminal"
        | "no-tickets"
        | "unsupported-state";
      state?: SportsMarketStateName;
    }
  | { kind: "failed"; reason: string; retryable: boolean };

export type SportsTerminalizerDeps = {
  findTicketIds: (marketId: bigint) => Promise<bigint[]>;
  logger?: KeeperLogger;
  now?: () => number;
  readMarket: (marketId: bigint) => Promise<SportsMarketRead>;
  readResult: (marketId: bigint) => Promise<SportsResultRead>;
  readTicket: (ticketId: bigint) => Promise<SportsTicketRead>;
  simulateFinalizeResult: (marketId: bigint) => Promise<void>;
  simulateRefundTicket: (ticketId: bigint) => Promise<void>;
  simulateSettleTicket: (ticketId: bigint) => Promise<void>;
  waitReceipt: (txHash: Hex) => Promise<{ status: "success" | "reverted" }>;
  writeFinalizeResult: (marketId: bigint) => Promise<Hex>;
  writeRefundTicket: (ticketId: bigint) => Promise<Hex>;
  writeSettleTicket: (ticketId: bigint) => Promise<Hex>;
};

const noopLogger: KeeperLogger = {
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined
};

export function mapSportsMarketState(state: number): SportsMarketStateName {
  const states: SportsMarketStateName[] = [
    "none",
    "draft",
    "open",
    "locked",
    "suspended",
    "resultProposed",
    "challenged",
    "resolved",
    "voided"
  ];
  return states[state] ?? "none";
}

export function mapSportsTicketState(state: number): SportsTicketStateName {
  const states: SportsTicketStateName[] = ["none", "held", "settled", "refunded", "voided"];
  return states[state] ?? "none";
}

export async function terminalizeSportsMarket(
  marketId: bigint,
  deps: SportsTerminalizerDeps
): Promise<SportsTerminalizeOutcome> {
  const now = deps.now ?? (() => Date.now());
  const logger = deps.logger ?? noopLogger;
  const startedAt = now();

  try {
    let market = await deps.readMarket(marketId);
    let finalizeTxHash: Hex | undefined;

    if (market.state === "challenged") {
      return { kind: "skipped", reason: "challenge-pending", state: market.state };
    }

    if (market.state === "resultProposed") {
      const result = await deps.readResult(marketId);
      if (result.challenged) {
        return { kind: "skipped", reason: "challenge-pending", state: market.state };
      }
      if (result.finalizesAt > Math.floor(now() / 1000)) {
        return {
          finalizesAt: result.finalizesAt,
          kind: "skipped",
          reason: "finality-pending",
          state: market.state
        };
      }

      await deps.simulateFinalizeResult(marketId);
      finalizeTxHash = await deps.writeFinalizeResult(marketId);
      const finalizeReceipt = await deps.waitReceipt(finalizeTxHash);
      if (finalizeReceipt.status !== "success") {
        return { kind: "failed", reason: "finalizeResult transaction reverted", retryable: true };
      }
      market = await deps.readMarket(marketId);
    }

    if (market.state !== "resolved" && market.state !== "voided") {
      return { kind: "skipped", reason: "market-not-terminal", state: market.state };
    }

    const ticketIds = await deps.findTicketIds(marketId);
    if (ticketIds.length === 0) {
      return { kind: "skipped", reason: "no-tickets", state: market.state };
    }

    let settled = 0;
    let refunded = 0;
    let skipped = 0;

    for (const ticketId of ticketIds) {
      const ticket = await deps.readTicket(ticketId);
      if (ticket.state !== "held") {
        skipped += 1;
        continue;
      }

      if (market.state === "resolved") {
        await deps.simulateSettleTicket(ticketId);
        const txHash = await deps.writeSettleTicket(ticketId);
        const receipt = await deps.waitReceipt(txHash);
        if (receipt.status !== "success") {
          return {
            kind: "failed",
            reason: `settleTicket(${ticketId}) transaction reverted`,
            retryable: true
          };
        }
        settled += 1;
      } else {
        await deps.simulateRefundTicket(ticketId);
        const txHash = await deps.writeRefundTicket(ticketId);
        const receipt = await deps.waitReceipt(txHash);
        if (receipt.status !== "success") {
          return {
            kind: "failed",
            reason: `refundTicket(${ticketId}) transaction reverted`,
            retryable: true
          };
        }
        refunded += 1;
      }
    }

    logger.info("sports.terminalizer.completed", {
      marketId: marketId.toString(),
      refunded,
      settled,
      skipped,
      state: market.state
    });

    return {
      finalizeTxHash,
      kind: "terminalized",
      latencyMs: now() - startedAt,
      marketState: market.state,
      refunded,
      settled,
      skipped
    };
  } catch (error) {
    const reason = describeError(error);
    logger.error("sports.terminalizer.failed", { marketId: marketId.toString(), error: reason });
    return { kind: "failed", reason, retryable: true };
  }
}

import type { Hex } from "viem";
import { describeError } from "./errors.js";
import { isTerminalState, shouldFinalize } from "./state.js";
import type { BetRead, FinalizeOutcome, KeeperEvent, KeeperLogger } from "./types.js";

export type FinalizerDeps = {
  readBet: (betId: bigint) => Promise<BetRead>;
  simulateFinalize: (betId: bigint) => Promise<void>;
  writeFinalize: (betId: bigint) => Promise<Hex>;
  readRefundClock?: () => Promise<{ timestamp: bigint }>;
  simulateRefund?: (betId: bigint) => Promise<void>;
  writeRefund?: (betId: bigint) => Promise<Hex>;
  waitFinalizeReceipt: (txHash: Hex) => Promise<{ status: "success" | "reverted" }>;
  materializeReceipt?: (event: KeeperEvent, txHash: Hex) => Promise<void>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  verifyAttempts?: number;
  verifyDelayMs?: number;
  logger?: KeeperLogger;
};

const noopLogger: KeeperLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function readTerminalAfterReceipt(event: KeeperEvent, deps: FinalizerDeps) {
  const attempts = deps.verifyAttempts ?? 5;
  const delayMs = deps.verifyDelayMs ?? 1_000;
  const sleep = deps.sleep ?? defaultSleep;
  let latest = await deps.readBet(event.betId);

  for (let attempt = 1; attempt < attempts && !isTerminalState(latest.state); attempt += 1) {
    await sleep(delayMs);
    latest = await deps.readBet(event.betId);
  }

  return latest;
}

export async function finalizeIfReady(
  event: KeeperEvent,
  deps: FinalizerDeps
): Promise<FinalizeOutcome> {
  const now = deps.now ?? (() => Date.now());
  const logger = deps.logger ?? noopLogger;
  const startedAt = now();
  const before = await deps.readBet(event.betId);

  if (!shouldFinalize(before.state) && before.state !== "pendingVrf") {
    if (isTerminalState(before.state)) {
      logger.info("casino.finalize.raced", { betId: event.betId.toString(), state: before.state });
      return { kind: "raced", state: before.state };
    }
    logger.info("casino.finalize.skipped", { betId: event.betId.toString(), state: before.state });
    return { kind: "skipped", state: before.state };
  }

  try {
    let action: "finalize" | "refund" = "finalize";
    if (before.state === "pendingVrf") {
      if (
        before.refundDeadline == null ||
        before.refundDeadline <= 0n ||
        !deps.readRefundClock ||
        !deps.simulateRefund ||
        !deps.writeRefund
      ) {
        throw new Error(
          "PendingVRF recovery requires a stored refund deadline and the on-chain clock"
        );
      }
      const { timestamp } = await deps.readRefundClock();
      const readyAt = before.refundDeadline;
      if (timestamp < readyAt) {
        // Reconcile callbacks or refunds from other callers at least once per minute.
        return {
          kind: "deferred",
          state: "pendingVrf",
          retryAfterMs: Math.min(Number(readyAt - timestamp) * 1000, 60_000)
        };
      }
      action = "refund";
    }
    await (action === "refund"
      ? deps.simulateRefund!(event.betId)
      : deps.simulateFinalize(event.betId));
    const txHash = await (action === "refund"
      ? deps.writeRefund!(event.betId)
      : deps.writeFinalize(event.betId));
    logger.info("casino.finalize.broadcast", {
      betId: event.betId.toString(),
      action,
      txHash,
      source: event.source,
      receivedToBroadcastMs: Math.max(0, now() - event.receivedAt),
      attemptToBroadcastMs: now() - startedAt
    });
    const receipt = await deps.waitFinalizeReceipt(txHash);
    if (receipt.status !== "success") {
      const raced = await deps.readBet(event.betId);
      if (isTerminalState(raced.state)) return { kind: "raced", state: raced.state };
      return { kind: "failed", reason: `${action} transaction reverted`, retryable: true };
    }

    const after = await readTerminalAfterReceipt(event, deps);
    if (isTerminalState(after.state)) {
      if (deps.materializeReceipt) {
        try {
          await deps.materializeReceipt(event, txHash);
        } catch (error) {
          logger.warn("casino.finalize.receipt_materialize_failed", {
            betId: event.betId.toString(),
            error: describeError(error),
            txHash
          });
        }
      }
      logger.info("casino.finalize.mined", {
        betId: event.betId.toString(),
        requestId: before.requestId.toString(),
        txHash,
        latencyMs: now() - startedAt
      });
      return { kind: "settled", txHash, latencyMs: now() - startedAt };
    }

    return {
      kind: "failed",
      reason: `finalize mined but bet remained ${after.state}`,
      retryable: true
    };
  } catch (error) {
    // A callback may make an eligible refund RandomReady, or another caller may finish first.
    // Re-read terminal state; a new RandomReady result remains retryable and is never refunded blindly.
    try {
      const raced = await deps.readBet(event.betId);
      if (isTerminalState(raced.state)) return { kind: "raced", state: raced.state };
    } catch {
      /* Preserve the original failure when the reconciliation read also fails. */
    }
    // The reason also lands in the public health snapshot, so it must not carry the RPC URL.
    const reason = describeError(error);
    logger.error("casino.finalize.failed", { betId: event.betId.toString(), error: reason });
    return { kind: "failed", reason, retryable: true };
  }
}

export function retryDelayMs(attempts: number) {
  const schedule = [2_000, 5_000, 10_000, 30_000] as const;
  return schedule[Math.min(attempts, schedule.length - 1)]!;
}

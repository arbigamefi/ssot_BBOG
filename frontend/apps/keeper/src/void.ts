import { decodeEventLog, getAddress, type Address, type Hex } from "viem";
import { GAME_HUB_KEEPER_ABI } from "./abi.js";
import { describeError, describeRevert, findContractRevert, isExecutionHalt } from "./errors.js";
import { isTerminalState } from "./state.js";
import type { BetRead, BetStateName, KeeperLogger, RequestRead } from "./types.js";

/** GameHub void constants (ADR-0037 §7.2, §10), read from the contract once. */
export type VoidParameters = {
  voidDelay: bigint;
  publicVoidDelay: bigint;
  settlementGas: bigint;
  reserveGas: bigint;
  callOverhead: bigint;
};

export const VOID_PARAMETER_FUNCTIONS = {
  voidDelay: "VOID_DELAY",
  publicVoidDelay: "PUBLIC_VOID_DELAY",
  settlementGas: "VOID_SETTLEMENT_GAS",
  reserveGas: "VOID_RESERVE_GAS",
  callOverhead: "VOID_CALL_OVERHEAD"
} as const satisfies Record<keyof VoidParameters, string>;

/** Room above the GameHub floor for intrinsic gas, calldata and the work before the gas check. */
export const VOID_GAS_HEADROOM = 150_000n;
/** Base caps a transaction at 16,777,216 gas (EIP-7825). */
export const MAX_VOID_GAS_LIMIT = 16_000_000n;
/** Equal to the SDK's VOID_BET_GAS_LIMIT, the limit players' voidBet transactions use. */
export const DEFAULT_VOID_GAS_LIMIT = 11_000_000n;
/** An unbookable result is retried, and its eligibility reread, at least this often. */
export const VOID_RECHECK_MS = 60_000;

/** A configuration the keeper must not run with; startup fails on it. */
export class VoidConfigurationError extends Error {
  override name = "VoidConfigurationError";
}

/** GameHub preconditions: the bet or its request changed state, a race rather than a booking failure. */
const SETTLEMENT_STATE_ERRORS = new Set(["BadState", "BetNotFound", "InvalidRandomReceipt"]);

/**
 * Whether a finalize simulation shows that a received result cannot be booked now: the settlement
 * reverted, or the EVM halted, for example out of gas. voidBet retries the settlement with
 * VOID_SETTLEMENT_GAS first, so a bet that only needed more gas settles there. Transport failures and
 * GameHub state preconditions do not qualify.
 */
export function isSettlementFailure(error: unknown) {
  const revert = findContractRevert(error);
  if (revert) return !SETTLEMENT_STATE_ERRORS.has(revert.errorName ?? "");
  return isExecutionHalt(error);
}

export function minimumVoidGasLimit(parameters: VoidParameters) {
  return (
    parameters.settlementGas + parameters.reserveGas + parameters.callOverhead + VOID_GAS_HEADROOM
  );
}

/** Below the floor voidBet reverts VoidGasTooLow; above the cap Base rejects the transaction. */
export function checkVoidGasLimit(gasLimit: bigint, parameters: VoidParameters) {
  const minimum = minimumVoidGasLimit(parameters);
  if (gasLimit >= minimum && gasLimit <= MAX_VOID_GAS_LIMIT) return;
  throw new VoidConfigurationError(
    `KEEPER_VOID_GAS_LIMIT=${gasLimit} must be at least ${minimum} (VOID_SETTLEMENT_GAS ` +
      `${parameters.settlementGas} + VOID_RESERVE_GAS ${parameters.reserveGas} + VOID_CALL_OVERHEAD ` +
      `${parameters.callOverhead} + ${VOID_GAS_HEADROOM}) and at most ${MAX_VOID_GAS_LIMIT}`
  );
}

/** GameHub.voidBet: 24 hours after the request inside a void window of the bet's Bank, otherwise 7 days. */
export function voidEligibleAt(
  vrfRequestedAt: bigint,
  cohortEnd: bigint,
  parameters: VoidParameters
) {
  return (
    vrfRequestedAt +
    (vrfRequestedAt <= cohortEnd ? parameters.voidDelay : parameters.publicVoidDelay)
  );
}

/** A received result whose settlement reverts. */
export type VoidCandidate = {
  betId: bigint;
  bank: Address;
  vrfRequestedAt: bigint;
  /**
   * Chain time in seconds the result was received: the block of its ResultReceived or BetRandomReady
   * event (`result`), else the VRF request time (`request`), which can only overstate the age.
   */
  receivedAt: bigint;
  receivedFrom: "result" | "request";
  /** Chain time in seconds from which voidBet may be called, as last computed. */
  eligibleAt: bigint;
  /** The settlement revert that made the bet a candidate. */
  reason: string;
  /** Local time the keeper first found the bet eligible, in milliseconds. */
  eligibleSeenAt?: number;
};

/** ADR-0037 §7.3 operating rule 3: eligible bets are attempted in VRF request order. */
export function compareVoidCandidates(a: VoidCandidate, b: VoidCandidate) {
  if (a.vrfRequestedAt !== b.vrfRequestedAt) return a.vrfRequestedAt < b.vrfRequestedAt ? -1 : 1;
  if (a.betId === b.betId) return 0;
  return a.betId < b.betId ? -1 : 1;
}

type ReceiptLog = { address?: Address | null; data: Hex; topics: readonly Hex[] };

export type VoidReceiptOutcome =
  | { outcome: "voided"; stake: bigint; caller: Address; settlementErrorPrefix: Hex }
  | { outcome: "settled" };

/**
 * The bet's outcome from the voidBet receipt: GameHub BetVoided when the settlement attempt failed,
 * BetFinalized when it settled inside voidBet. The Bank's BetVoided has another signature and address.
 */
export function decodeVoidReceipt({
  betId,
  gameHub,
  logs
}: {
  betId: bigint;
  gameHub: Address;
  logs: readonly ReceiptLog[];
}): VoidReceiptOutcome | undefined {
  for (const log of logs) {
    if (log.address == null || getAddress(log.address) !== getAddress(gameHub)) continue;
    let decoded: { eventName?: string; args?: unknown };
    try {
      decoded = decodeEventLog({
        abi: GAME_HUB_KEEPER_ABI,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]]
      });
    } catch {
      continue;
    }
    const args = (decoded.args ?? {}) as Record<string, unknown>;
    if (args.positionId !== betId) continue;
    if (decoded.eventName === "BetVoided")
      return {
        outcome: "voided",
        stake: args.stake as bigint,
        caller: args.caller as Address,
        settlementErrorPrefix: args.settlementErrorPrefix as Hex
      };
    if (decoded.eventName === "BetFinalized") return { outcome: "settled" };
  }
  return undefined;
}

export type VoidAttemptDeps = {
  gameHub: Address;
  gasLimit: bigint;
  readBet: (betId: bigint) => Promise<BetRead>;
  readRequest: (bet: BetRead) => Promise<RequestRead>;
  simulateFinalize: (betId: bigint) => Promise<void>;
  /** Simulates voidBet with `gasLimit`; true when the void branch would run. */
  simulateVoid: (betId: bigint) => Promise<boolean>;
  writeVoid: (betId: bigint) => Promise<Hex>;
  waitVoidReceipt: (
    txHash: Hex
  ) => Promise<{ status: "success" | "reverted"; logs: readonly ReceiptLog[] }>;
  materializeReceipt?: (betId: bigint, txHash: Hex) => Promise<void>;
  logger?: KeeperLogger;
  now?: () => number;
};

export type VoidAttemptOutcome =
  | { kind: "voided"; txHash: Hex; stake: bigint; settlementErrorPrefix: Hex; latencyMs: number }
  | { kind: "settled"; txHash: Hex; latencyMs: number }
  /** Already terminal: settled, refunded or voided by someone else. */
  | { kind: "raced"; state: BetStateName }
  /** No longer an open bet with a received result. */
  | { kind: "dropped"; reason: string }
  /** Its settlement simulates successfully again: back to the normal finalize path. */
  | { kind: "bookable" }
  | { kind: "notEligible"; eligibleAt: bigint }
  | { kind: "configurationError"; reason: string }
  | { kind: "failed"; reason: string; txHash?: Hex };

const noopLogger: KeeperLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

/**
 * Attempts one eligible candidate. The normal settlement is simulated first; only if it still reverts
 * is voidBet simulated and sent with the configured gas limit. voidBet itself tries settlement once
 * more with exactly VOID_SETTLEMENT_GAS, so the receipt decides the outcome.
 */
export async function attemptVoid(
  candidate: VoidCandidate,
  deps: VoidAttemptDeps
): Promise<VoidAttemptOutcome> {
  const now = deps.now ?? Date.now;
  const logger = deps.logger ?? noopLogger;
  const startedAt = now();
  const betId = candidate.betId;
  let txHash: Hex | undefined;
  try {
    const bet = await deps.readBet(betId);
    if (isTerminalState(bet.state)) return { kind: "raced", state: bet.state };
    if (bet.state !== "randomReady" && bet.state !== "pendingVrf")
      return { kind: "dropped", reason: `bet is ${bet.state}` };
    const request = await deps.readRequest(bet);
    if (request.state !== "received")
      return { kind: "dropped", reason: `canonical VRF request is ${request.state}` };
    try {
      await deps.simulateFinalize(betId);
      return { kind: "bookable" };
    } catch (error) {
      if (!isSettlementFailure(error)) throw error;
    }
    let voidBranch: boolean;
    try {
      voidBranch = await deps.simulateVoid(betId);
    } catch (error) {
      const revert = findContractRevert(error);
      if (revert?.errorName === "VoidGasTooLow")
        return {
          kind: "configurationError",
          reason: `voidBet needs more gas than KEEPER_VOID_GAS_LIMIT=${deps.gasLimit}: ${describeRevert(error)}`
        };
      const eligibleAt = revert?.errorName === "VoidNotEligible" ? revert.args?.[2] : undefined;
      if (typeof eligibleAt === "bigint") return { kind: "notEligible", eligibleAt };
      throw error;
    }
    txHash = await deps.writeVoid(betId);
    logger.info("casino.void.broadcast", {
      betId: betId.toString(),
      txHash,
      gasLimit: deps.gasLimit.toString(),
      vrfRequestedAt: candidate.vrfRequestedAt.toString(),
      eligibleAt: candidate.eligibleAt.toString(),
      simulated: voidBranch ? "voided" : "settled"
    });
    const receipt = await deps.waitVoidReceipt(txHash);
    if (receipt.status !== "success") throw new Error("voidBet transaction reverted");
    const outcome = decodeVoidReceipt({ betId, gameHub: deps.gameHub, logs: receipt.logs });
    if (!outcome)
      throw new Error("voidBet receipt has neither BetVoided nor BetFinalized for the bet");
    if (deps.materializeReceipt) {
      try {
        await deps.materializeReceipt(betId, txHash);
      } catch (error) {
        logger.warn("casino.void.receipt_materialize_failed", {
          betId: betId.toString(),
          txHash,
          error: describeError(error)
        });
      }
    }
    const latencyMs = now() - startedAt;
    logger.info("casino.void.mined", {
      betId: betId.toString(),
      txHash,
      outcome: outcome.outcome,
      ...(outcome.outcome === "voided"
        ? {
            stake: outcome.stake.toString(),
            settlementErrorPrefix: outcome.settlementErrorPrefix
          }
        : {}),
      latencyMs
    });
    return outcome.outcome === "voided"
      ? {
          kind: "voided",
          txHash,
          stake: outcome.stake,
          settlementErrorPrefix: outcome.settlementErrorPrefix,
          latencyMs
        }
      : { kind: "settled", txHash, latencyMs };
  } catch (error) {
    // Another caller may have finished the bet first; a terminal state then is not a failure.
    try {
      const raced = await deps.readBet(betId);
      if (isTerminalState(raced.state)) return { kind: "raced", state: raced.state };
    } catch {
      /* Keep the original failure when the reconciliation read fails too. */
    }
    return { kind: "failed", reason: describeRevert(error), ...(txHash ? { txHash } : {}) };
  }
}

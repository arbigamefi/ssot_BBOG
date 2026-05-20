"use client";

import * as React from "react";
import type { DomainSportsMarket } from "@ssot/ssot";
import type {
  PlaceSportsTicketInput,
  PlaceSportsTicketPlan,
  SSOTSDK,
  SportsOddsSnapshotInput
} from "@ssot/ssot/sdk";
import type { SSOTRelease } from "@ssot/ssot/release";
import type { SportsbookProviderOdds } from "./provider-odds";
import { toSportsbookPlayerError } from "./sports-errors";

/**
 * useBetSlip — the player-facing ticket placement state machine.
 *
 * Goal: collapse the previous 3-button operator workflow (fetch odds → plan →
 * place) into a single declarative hook that fires the entire chain when the
 * player presses "Place bet". The state machine surfaces explicit transition
 * points so the BetSlip UI can render meaningful copy at each step.
 *
 * The player path auto-fills signed odds, nonce, and risk-hash fields from the
 * signed odds endpoint. Operator-only market controls stay isolated on
 * /ops/sportsbook; public players should never see raw placement plumbing.
 *
 * State machine:
 *
 *   idle
 *    ├─ outcome / stake set ─▶ ready
 *    ├─ submit() called      ─▶ fetchingOdds ─▶ planning ─▶ signing ─▶ mining ─▶ placed
 *    └─ any step fails       ─▶ error (with retry possible)
 */

export type BetSlipState =
  | "idle"
  | "ready"
  | "fetchingOdds"
  | "planning"
  | "signing"
  | "mining"
  | "placed"
  | "error";

export interface BetSlipReceipt {
  eventId?: bigint;
  marketId?: bigint;
  outcomeId?: number;
  player?: string;
  poolId?: number;
  stake?: string;
  ticketId?: bigint;
  txHash?: string;
  payout?: string;
  outcomeName?: string;
  decimalPrice?: string;
}

export interface BetSlipController {
  state: BetSlipState;
  error?: string;
  receipt?: BetSlipReceipt;
  /** Set the current outcome selection (clears any pending receipt). */
  selectOutcome: (outcomeId: number | undefined) => void;
  selectedOutcomeId?: number;
  /** Stake string as the user typed it (raw, locale-aware). */
  stake: string;
  setStake: (value: string) => void;
  /** Triggers the full end-to-end placement flow. */
  submit: () => Promise<void>;
  /** Reset to idle. Used by the slip's "Place another bet" CTA. */
  reset: () => void;
  /** Convenience flag for the place button. */
  canSubmit: boolean;
  /** Convenience flag describing why the button is disabled. */
  blockedReason?: string;
}

interface UseBetSlipParams {
  sdk?: SSOTSDK;
  release?: SSOTRelease;
  chainId?: number;
  market: DomainSportsMarket;
  defaultOutcomeId?: number;
  defaultSportKey?: string;
  providerOdds?: SportsbookProviderOdds;
  /** Wallet must be connected for placement to proceed. */
  walletConnected: boolean;
  /** External disabled signal (e.g., ticketing flag off, market not open). */
  disabled?: boolean;
  /** Human-readable explanation when `disabled` is true. */
  disabledReason?: string;
  /** Decimal places of the stake asset (USDC = 6, etc.). */
  decimals: number;
  /** Re-fetch market state after a successful placement. */
  onPlaced?: (receipt: BetSlipReceipt) => void;
}

interface SignedOddsSnapshotResponse {
  provider: { providerEventId?: string; bookmakerKey?: string; sportKey?: string };
  outcome: { name: string; decimalPrice: string; oddsWad: string };
  payout: string;
  odds: {
    oddsWad: string;
    maxStake: string;
    maxPayout: string;
    expiresAt: string;
    nonce: string;
    riskHash: string;
  };
  signature: string;
}

function parseDecimalUnits(value: string, decimals: number): bigint | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d*\.?\d*$/.test(trimmed)) return undefined;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) return undefined;
  const paddedFraction = fraction.padEnd(decimals, "0");
  try {
    return BigInt(whole + paddedFraction);
  } catch {
    return undefined;
  }
}

function getPoolRiskHash(release: SSOTRelease, poolId: number): string | undefined {
  const pool = release.pools?.find((p) => Number(p.poolId) === poolId);
  return pool?.sportsRisk?.riskHash;
}

export function useBetSlip(params: UseBetSlipParams): BetSlipController {
  const {
    sdk,
    release,
    chainId,
    market,
    defaultOutcomeId,
    defaultSportKey,
    providerOdds,
    walletConnected,
    disabled,
    disabledReason,
    decimals,
    onPlaced
  } = params;

  const [state, setState] = React.useState<BetSlipState>("idle");
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [receipt, setReceipt] = React.useState<BetSlipReceipt | undefined>(undefined);
  const [selectedOutcomeId, setSelectedOutcomeId] = React.useState<number | undefined>(
    defaultOutcomeId
  );
  const [stake, setStake] = React.useState("");

  // Reset selection when the market changes (player navigated from a list).
  React.useEffect(() => {
    setSelectedOutcomeId(defaultOutcomeId);
    setStake("");
    setReceipt(undefined);
    setError(undefined);
    setState("idle");
  }, [market.marketId, defaultOutcomeId]);

  // Derive ready/idle without forcing a re-render when stake length changes.
  React.useEffect(() => {
    if (state === "placed" || state === "error") return;
    if (
      state === "fetchingOdds" ||
      state === "planning" ||
      state === "signing" ||
      state === "mining"
    )
      return;
    const stakeParsed = parseDecimalUnits(stake, decimals);
    if (selectedOutcomeId !== undefined && stakeParsed && stakeParsed > 0n) {
      setState("ready");
    } else {
      setState("idle");
    }
  }, [stake, selectedOutcomeId, decimals, state]);

  const selectOutcome = React.useCallback((outcomeId: number | undefined) => {
    setSelectedOutcomeId(outcomeId);
    setReceipt(undefined);
    setError(undefined);
  }, []);

  const reset = React.useCallback(() => {
    setReceipt(undefined);
    setError(undefined);
    setStake("");
    setSelectedOutcomeId(defaultOutcomeId);
    setState("idle");
  }, [defaultOutcomeId]);

  const fetchSignedOdds = React.useCallback(
    async (outcomeId: number, stakeBigint: bigint): Promise<SignedOddsSnapshotResponse> => {
      if (!sdk?.account) throw new Error("Wallet is not connected.");
      const response = await fetch("/api/sportsbook/odds-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId,
          marketId: market.marketId.toString(),
          outcomeId,
          player: sdk.account,
          stake: stakeBigint.toString(),
          providerEventId: providerOdds?.provider.providerEventId,
          bookmakerKey: providerOdds?.provider.bookmakerKey,
          sportKey: providerOdds?.provider.sportKey ?? defaultSportKey ?? undefined
        })
      });
      const body = (await response.json()) as
        | SignedOddsSnapshotResponse
        | { error?: { message?: string } };
      if (!response.ok) {
        const message =
          "error" in body && body.error?.message
            ? body.error.message
            : "Could not fetch signed odds.";
        throw new Error(message);
      }
      return body as SignedOddsSnapshotResponse;
    },
    [
      sdk?.account,
      chainId,
      market.marketId,
      providerOdds?.provider.providerEventId,
      providerOdds?.provider.bookmakerKey,
      providerOdds?.provider.sportKey,
      defaultSportKey
    ]
  );

  const buildPlan = React.useCallback(
    async (signed: SignedOddsSnapshotResponse, outcomeId: number, stakeBigint: bigint) => {
      if (!sdk) throw new Error("SDK is not ready.");
      if (chainId === undefined) throw new Error("Chain id is not available.");
      const riskHash =
        signed.odds.riskHash ?? (release ? getPoolRiskHash(release, market.poolId) : undefined);
      if (!riskHash) throw new Error("Pool risk hash is not configured.");

      const odds: SportsOddsSnapshotInput = {
        marketId: market.marketId,
        outcomeId,
        marketVersion: market.version,
        oddsWad: BigInt(signed.odds.oddsWad),
        maxStake: BigInt(signed.odds.maxStake),
        maxPayout: BigInt(signed.odds.maxPayout),
        expiresAt: BigInt(signed.odds.expiresAt),
        nonce: BigInt(signed.odds.nonce),
        riskHash: riskHash as `0x${string}`
      };

      const input: PlaceSportsTicketInput = {
        chainId,
        marketId: market.marketId,
        outcomeId,
        stake: stakeBigint,
        odds,
        signature: signed.signature as `0x${string}`
      };

      const result = await sdk.sportsHub.planPlaceTicket(input);
      if ("error" in result) {
        throw new Error(result.error.message);
      }
      return result as PlaceSportsTicketPlan;
    },
    [release, market, sdk, chainId]
  );

  const submit = React.useCallback(async () => {
    if (selectedOutcomeId === undefined) {
      setError("Pick an outcome first.");
      setState("error");
      return;
    }
    const stakeBigint = parseDecimalUnits(stake, decimals);
    if (!stakeBigint || stakeBigint <= 0n) {
      setError("Enter a positive stake.");
      setState("error");
      return;
    }
    if (!sdk?.account) {
      setError("Connect your wallet to place a ticket.");
      setState("error");
      return;
    }
    setError(undefined);

    try {
      setState("fetchingOdds");
      const signed = await fetchSignedOdds(selectedOutcomeId, stakeBigint);
      setState("planning");
      const plan = await buildPlan(signed, selectedOutcomeId, stakeBigint);
      setState("signing");
      const result = await sdk.sportsHub.executeTicketPlan(plan);
      if (!result.placeTicketTx.ok) {
        throw new Error(result.placeTicketTx.error?.message ?? "Ticket placement failed on-chain.");
      }
      // executeTicketPlan returns after the tx is mined; surface mining tween
      // briefly so the UI shows the "mining" step rather than jumping straight
      // to "placed".
      setState("mining");
      await new Promise((r) => setTimeout(r, 250));
      const nextReceipt: BetSlipReceipt = {
        eventId: market.eventId,
        marketId: market.marketId,
        outcomeId: selectedOutcomeId,
        player: sdk.account,
        poolId: market.poolId,
        stake: stakeBigint.toString(),
        ticketId: result.ticketId,
        txHash: result.placeTicketTx.txHash,
        payout: signed.payout,
        outcomeName: signed.outcome.name,
        decimalPrice: signed.outcome.decimalPrice
      };
      setReceipt(nextReceipt);
      setState("placed");
      onPlaced?.(nextReceipt);
    } catch (err) {
      setError(toSportsbookPlayerError(err));
      setState("error");
    }
  }, [buildPlan, decimals, fetchSignedOdds, onPlaced, sdk, selectedOutcomeId, stake]);

  const canSubmit = React.useMemo(() => {
    if (disabled) return false;
    if (!walletConnected) return false;
    if (selectedOutcomeId === undefined) return false;
    const stakeParsed = parseDecimalUnits(stake, decimals);
    if (!stakeParsed || stakeParsed <= 0n) return false;
    return state === "ready" || state === "error" || state === "placed";
  }, [disabled, walletConnected, selectedOutcomeId, stake, decimals, state]);

  const blockedReason = React.useMemo(() => {
    if (disabled) return disabledReason;
    if (!walletConnected) return "Connect your wallet to place a ticket.";
    if (selectedOutcomeId === undefined) return "Pick an outcome.";
    const stakeParsed = parseDecimalUnits(stake, decimals);
    if (!stakeParsed || stakeParsed <= 0n) return "Enter a stake.";
    return undefined;
  }, [disabled, disabledReason, walletConnected, selectedOutcomeId, stake, decimals]);

  return {
    state,
    error,
    receipt,
    selectOutcome,
    selectedOutcomeId,
    stake,
    setStake,
    submit,
    reset,
    canSubmit,
    blockedReason
  };
}

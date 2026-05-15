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
import { toast } from "@ssot/ui";

import { DetailCell } from "./components";
import { formatLookupError, shortHex } from "./format";

type TicketPlacementStatus = {
  busy: boolean;
  label: string;
  txHash?: string;
  error?: string;
};

type TicketPlacementForm = {
  outcomeId: string;
  stake: string;
  oddsWad: string;
  maxStake: string;
  maxPayout: string;
  expiresAt: string;
  nonce: string;
  riskHash: string;
  signature: string;
};

const EMPTY_FORM: TicketPlacementForm = {
  outcomeId: "0",
  stake: "",
  oddsWad: "",
  maxStake: "",
  maxPayout: "",
  expiresAt: "",
  nonce: "0",
  riskHash: "",
  signature: ""
};

function parsePositiveBigInt(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) throw new Error(`${label} must be a positive integer.`);
  const parsed = BigInt(trimmed);
  if (parsed <= 0n) throw new Error(`${label} must be greater than zero.`);
  return parsed;
}

function parseNonNegativeBigInt(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) throw new Error(`${label} must be an integer.`);
  return BigInt(trimmed);
}

function parseOutcomeId(value: string, market: DomainSportsMarket) {
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) throw new Error("Outcome id must be a non-negative integer.");
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) throw new Error("Outcome id is too large.");
  if (parsed < 0 || parsed >= market.outcomeCount) {
    throw new Error(`Outcome id must be between 0 and ${market.outcomeCount - 1}.`);
  }
  return parsed;
}

function parseHex(value: string, label: string, exactBytes?: number) {
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]*$/.test(trimmed)) throw new Error(`${label} must be 0x-prefixed hex.`);
  if (exactBytes !== undefined && trimmed.length !== 2 + exactBytes * 2) {
    throw new Error(`${label} must be ${exactBytes} bytes.`);
  }
  return trimmed as `0x${string}`;
}

function getPoolRiskHash(release: SSOTRelease, poolId: number) {
  return release.pools.find((pool) => pool.poolId === poolId)?.sportsRisk?.riskHash;
}

function makeInput(
  chainId: number,
  market: DomainSportsMarket,
  form: TicketPlacementForm
): PlaceSportsTicketInput {
  const outcomeId = parseOutcomeId(form.outcomeId, market);
  const odds: SportsOddsSnapshotInput = {
    marketId: market.marketId,
    outcomeId,
    marketVersion: market.version,
    oddsWad: parsePositiveBigInt(form.oddsWad, "Odds WAD"),
    maxStake: parsePositiveBigInt(form.maxStake, "Max stake"),
    maxPayout: parsePositiveBigInt(form.maxPayout, "Max payout"),
    expiresAt: parsePositiveBigInt(form.expiresAt, "Expires at"),
    nonce: parseNonNegativeBigInt(form.nonce, "Nonce"),
    riskHash: parseHex(form.riskHash, "Risk hash", 32)
  };

  return {
    chainId,
    marketId: market.marketId,
    outcomeId,
    stake: parsePositiveBigInt(form.stake, "Stake"),
    odds,
    signature: parseHex(form.signature, "Signature")
  };
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  mono = true
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label htmlFor={id} className="grid gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
        {label}
      </span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={[
          "min-h-11 rounded-md border border-border bg-surface-0 px-3 text-sm text-fg",
          "outline-none transition-colors placeholder:text-fg-subtle focus:border-brand",
          mono ? "font-mono" : ""
        ].join(" ")}
      />
    </label>
  );
}

export function SportsbookTicketPlacementPanel({
  sdk,
  release,
  chainId,
  market,
  disabled,
  disabledReason,
  onMutated
}: {
  sdk?: SSOTSDK;
  release: SSOTRelease;
  chainId: number;
  market: DomainSportsMarket;
  disabled: boolean;
  disabledReason?: string;
  onMutated?: () => void;
}) {
  const defaultRiskHash = getPoolRiskHash(release, market.poolId) ?? "";
  const [form, setForm] = React.useState<TicketPlacementForm>({
    ...EMPTY_FORM,
    riskHash: defaultRiskHash
  });
  const [plan, setPlan] = React.useState<PlaceSportsTicketPlan | undefined>();
  const [status, setStatus] = React.useState<TicketPlacementStatus>({
    busy: false,
    label: "No ticket plan created."
  });

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      outcomeId: "0",
      riskHash: getPoolRiskHash(release, market.poolId) ?? ""
    }));
    setPlan(undefined);
  }, [market.marketId, market.poolId, release]);

  const update = React.useCallback((key: keyof TicketPlacementForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setPlan(undefined);
  }, []);

  const buildPlan = React.useCallback(async () => {
    if (!sdk) return undefined;
    const input = makeInput(chainId, market, form);
    const result = await sdk.sportsHub.planPlaceTicket(input);
    if ("error" in result) {
      throw new Error(result.error.message);
    }
    setPlan(result);
    return result;
  }, [chainId, form, market, sdk]);

  const onPlan = React.useCallback(async () => {
    try {
      setStatus({ busy: true, label: "Planning ticket..." });
      const nextPlan = await buildPlan();
      setStatus({
        busy: false,
        label: nextPlan?.preview.needsApproval ? "Plan ready: approval required." : "Plan ready."
      });
    } catch (error) {
      const message = formatLookupError(error) ?? "Ticket planning failed.";
      setStatus({ busy: false, label: "Planning failed.", error: message });
      toast.error(message);
    }
  }, [buildPlan]);

  const onPlace = React.useCallback(async () => {
    if (!sdk) return;
    try {
      setStatus({ busy: true, label: "Submitting ticket..." });
      const executablePlan = plan ?? (await buildPlan());
      if (!executablePlan) throw new Error("Ticket plan is unavailable.");
      const result = await sdk.sportsHub.executeTicketPlan(executablePlan);
      if (!result.placeTicketTx.ok) {
        const message = result.placeTicketTx.error?.message ?? "Ticket placement failed.";
        setStatus({ busy: false, label: "Ticket failed.", error: message });
        toast.error(message);
        return;
      }
      setStatus({
        busy: false,
        label: result.ticketId
          ? `Ticket ${result.ticketId.toString()} submitted.`
          : "Ticket submitted.",
        txHash: result.placeTicketTx.txHash
      });
      toast.success("Ticket submitted");
      onMutated?.();
    } catch (error) {
      const message = formatLookupError(error) ?? "Ticket placement failed.";
      setStatus({ busy: false, label: "Ticket failed.", error: message });
      toast.error(message);
    }
  }, [buildPlan, onMutated, plan, sdk]);

  const actionDisabled = disabled || status.busy || !sdk?.account || market.state !== "open";

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <DetailCell
          label="Gate"
          value={disabled ? "Locked" : "Enabled"}
          helper={disabledReason ?? "Requires enabled release metadata, frontend flag, and wallet."}
          mono={false}
        />
        <DetailCell
          label="Market"
          value={`${market.state} / v${market.version.toString()}`}
          helper={`Pool ${market.poolId}, ${market.outcomeCount} outcomes`}
          mono={false}
        />
        <DetailCell label="Last tx" value={status.txHash ?? "N/A"} />
      </div>

      <div className="rounded-lg border border-border bg-surface-2/70 p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field
            id="sports-ticket-outcome"
            label="Outcome id"
            value={form.outcomeId}
            onChange={(value) => update("outcomeId", value)}
            placeholder="0"
          />
          <Field
            id="sports-ticket-stake"
            label="Stake raw units"
            value={form.stake}
            onChange={(value) => update("stake", value)}
            placeholder="1000000"
          />
          <Field
            id="sports-ticket-odds"
            label="Odds WAD"
            value={form.oddsWad}
            onChange={(value) => update("oddsWad", value)}
            placeholder="2100000000000000000"
          />
          <Field
            id="sports-ticket-max-stake"
            label="Max stake"
            value={form.maxStake}
            onChange={(value) => update("maxStake", value)}
            placeholder="2000000"
          />
          <Field
            id="sports-ticket-max-payout"
            label="Max payout"
            value={form.maxPayout}
            onChange={(value) => update("maxPayout", value)}
            placeholder="4200000"
          />
          <Field
            id="sports-ticket-expires"
            label="Expires at"
            value={form.expiresAt}
            onChange={(value) => update("expiresAt", value)}
            placeholder="Unix seconds"
          />
          <Field
            id="sports-ticket-nonce"
            label="Nonce"
            value={form.nonce}
            onChange={(value) => update("nonce", value)}
            placeholder="0"
          />
          <div className="xl:col-span-2">
            <Field
              id="sports-ticket-risk-hash"
              label="Risk hash"
              value={form.riskHash}
              onChange={(value) => update("riskHash", value)}
              placeholder="0x..."
            />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <Field
              id="sports-ticket-signature"
              label="Odds signature"
              value={form.signature}
              onChange={(value) => update("signature", value)}
              placeholder="0x..."
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={actionDisabled}
            onClick={onPlan}
            className="min-h-11 rounded-md border border-border bg-surface-1 px-4 text-sm font-black text-fg transition-colors hover:border-brand/40 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Plan ticket
          </button>
          <button
            type="button"
            disabled={actionDisabled}
            onClick={onPlace}
            className="min-h-11 rounded-md bg-brand px-4 text-sm font-black text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Place ticket
          </button>
        </div>

        {status.error ? (
          <div className="mt-3 text-xs leading-5 text-danger">{status.error}</div>
        ) : null}
        {!sdk?.account ? (
          <div className="mt-3 text-xs leading-5 text-warn">Connect a wallet to place tickets.</div>
        ) : null}
      </div>

      {plan ? (
        <div className="grid gap-4 md:grid-cols-3">
          <DetailCell
            label="Approval"
            value={plan.preview.needsApproval ? "Required" : "Not required"}
            helper={
              plan.preview.needsApproval
                ? `Approve ${plan.preview.approveAmount?.toString() ?? "0"}`
                : `Allowance ${plan.preview.allowance.toString()}`
            }
            mono={false}
          />
          <DetailCell label="Odds ticket hash" value={shortHex(plan.preview.oddsTicketHash)} />
          <DetailCell label="Plan state" value={status.label} helper={status.error} mono={false} />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
          Paste a signed odds snapshot from the provider path, plan it, then submit through the SDK.
          Unsigned or stale odds are rejected before broadcast.
        </div>
      )}
    </div>
  );
}

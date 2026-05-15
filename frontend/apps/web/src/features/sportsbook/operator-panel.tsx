"use client";

import * as React from "react";
import type { SSOTSDK, TxResult } from "@ssot/ssot/sdk";
import { toast } from "@ssot/ui";

import { formatLookupError, parseLookupId } from "./format";
import { DetailCell, StatusPill } from "./components";

const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;

type OperatorStatus = {
  busy: boolean;
  label: string;
  txHash?: string;
  error?: string;
};

function parsePositiveBigInt(value: string, label: string) {
  const parsed = parseLookupId(value);
  if (parsed === undefined || parsed <= 0n) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function parsePositiveNumber(value: string, label: string) {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseBytes32(value: string, label: string) {
  const normalized = value.trim();
  if (!BYTES32_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a 32-byte hex value.`);
  }
  return normalized as `0x${string}`;
}

function OperatorInput({
  id,
  label,
  value,
  onChange,
  placeholder
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-fg-subtle"
    >
      {label}
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-11 rounded-md border border-border bg-surface-0 px-3 font-mono text-sm normal-case tracking-normal text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand"
      />
    </label>
  );
}

function OperatorButton({
  children,
  disabled,
  onClick,
  variant = "default"
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        variant === "danger"
          ? "min-h-11 rounded-md border border-danger/30 bg-danger-soft px-4 text-sm font-black text-danger transition-colors hover:border-danger/50 disabled:cursor-not-allowed disabled:opacity-50"
          : "min-h-11 rounded-md bg-brand px-4 text-sm font-black text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

export function SportsbookOperatorPanel({
  sdk,
  disabled,
  disabledReason,
  defaultPoolId,
  defaultFinalitySeconds,
  onMutated
}: {
  sdk?: SSOTSDK;
  disabled: boolean;
  disabledReason?: string;
  defaultPoolId?: number;
  defaultFinalitySeconds?: string;
  onMutated?: () => void;
}) {
  const [status, setStatus] = React.useState<OperatorStatus>({
    busy: false,
    label: "No operator transaction submitted."
  });
  const [eventId, setEventId] = React.useState("");
  const [poolId, setPoolId] = React.useState(defaultPoolId ? String(defaultPoolId) : "");
  const [outcomeCount, setOutcomeCount] = React.useState("3");
  const [startsAt, setStartsAt] = React.useState("");
  const [lockTime, setLockTime] = React.useState("");
  const [resultFinalitySeconds, setResultFinalitySeconds] = React.useState(
    defaultFinalitySeconds ?? "604800"
  );
  const [marketKey, setMarketKey] = React.useState("");
  const [rulebookHash, setRulebookHash] = React.useState("");
  const [marketId, setMarketId] = React.useState("");
  const [winningOutcomeId, setWinningOutcomeId] = React.useState("");
  const [resultSourceHash, setResultSourceHash] = React.useState("");
  const [evidenceHash, setEvidenceHash] = React.useState("");
  const [observedAt, setObservedAt] = React.useState("");
  const [voidReasonHash, setVoidReasonHash] = React.useState("");

  React.useEffect(() => {
    if (!poolId && defaultPoolId) setPoolId(String(defaultPoolId));
  }, [defaultPoolId, poolId]);

  async function run(label: string, action: () => Promise<TxResult>) {
    if (!sdk) return;
    setStatus({ busy: true, label });
    try {
      const result = await action();
      if (!result.ok) {
        const message = result.error?.message ?? `${label} failed.`;
        setStatus({ busy: false, label, error: message });
        toast.error(message);
        return;
      }
      setStatus({ busy: false, label, txHash: result.txHash });
      toast.success(`${label} submitted`);
      onMutated?.();
    } catch (error) {
      const message = formatLookupError(error) ?? `${label} failed.`;
      setStatus({ busy: false, label, error: message });
      toast.error(message);
    }
  }

  const actionDisabled = disabled || status.busy || !sdk?.account;

  const createMarket = React.useCallback(() => {
    void run("Create market", async () => {
      if (!sdk) throw new Error("SDK unavailable.");
      return sdk.sportsHub.createMarket({
        eventId: parsePositiveBigInt(eventId, "Event id"),
        poolId: parsePositiveNumber(poolId, "Pool id"),
        outcomeCount: parsePositiveNumber(outcomeCount, "Outcome count"),
        startsAt: parsePositiveBigInt(startsAt, "Starts at"),
        lockTime: parsePositiveBigInt(lockTime, "Lock time"),
        resultFinalitySeconds: parsePositiveBigInt(resultFinalitySeconds, "Result finality"),
        marketKey: parseBytes32(marketKey, "Market key"),
        rulebookHash: parseBytes32(rulebookHash, "Rulebook hash")
      });
    });
  }, [
    eventId,
    lockTime,
    marketKey,
    outcomeCount,
    poolId,
    resultFinalitySeconds,
    rulebookHash,
    sdk,
    startsAt
  ]);

  const openMarket = React.useCallback(() => {
    void run("Open market", async () => {
      if (!sdk) throw new Error("SDK unavailable.");
      return sdk.sportsHub.openMarket(parsePositiveBigInt(marketId, "Market id"));
    });
  }, [marketId, sdk]);

  const lockMarket = React.useCallback(() => {
    void run("Lock market", async () => {
      if (!sdk) throw new Error("SDK unavailable.");
      return sdk.sportsHub.lockMarket(parsePositiveBigInt(marketId, "Market id"));
    });
  }, [marketId, sdk]);

  const proposeResult = React.useCallback(() => {
    void run("Propose result", async () => {
      if (!sdk) throw new Error("SDK unavailable.");
      return sdk.sportsHub.proposeResult({
        marketId: parsePositiveBigInt(marketId, "Market id"),
        winningOutcomeId: parsePositiveNumber(winningOutcomeId, "Winning outcome"),
        resultSourceHash: parseBytes32(resultSourceHash, "Result source hash"),
        evidenceHash: parseBytes32(evidenceHash, "Evidence hash"),
        observedAt: parsePositiveBigInt(observedAt, "Observed at")
      });
    });
  }, [evidenceHash, marketId, observedAt, resultSourceHash, sdk, winningOutcomeId]);

  const finalizeResult = React.useCallback(() => {
    void run("Finalize result", async () => {
      if (!sdk) throw new Error("SDK unavailable.");
      return sdk.sportsHub.finalizeResult(parsePositiveBigInt(marketId, "Market id"));
    });
  }, [marketId, sdk]);

  const voidMarket = React.useCallback(() => {
    void run("Void market", async () => {
      if (!sdk) throw new Error("SDK unavailable.");
      return sdk.sportsHub.voidMarket(
        parsePositiveBigInt(marketId, "Market id"),
        parseBytes32(voidReasonHash, "Void reason hash")
      );
    });
  }, [marketId, sdk, voidReasonHash]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <DetailCell
          label="Write status"
          value={sdk?.account ? "Wallet connected" : "Wallet required"}
          helper={disabledReason ?? "Contract roles are enforced on-chain by SportsHub."}
          mono={false}
        />
        <DetailCell label="Last action" value={status.label} helper={status.error} mono={false} />
        <DetailCell label="Last tx" value={status.txHash ?? "N/A"} />
      </div>

      <div className="flex flex-wrap gap-3">
        <StatusPill tone={disabled ? "warn" : "success"}>
          {disabled ? "Read-only" : "Writable"}
        </StatusPill>
        <StatusPill tone={sdk?.account ? "success" : "warn"}>
          {sdk?.account ? "Wallet connected" : "No wallet"}
        </StatusPill>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-2/70 p-5">
          <div className="text-sm font-black text-fg">Create fixed-odds market</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <OperatorInput
              id="sports-create-event"
              label="Event id"
              value={eventId}
              onChange={setEventId}
            />
            <OperatorInput
              id="sports-create-pool"
              label="Pool id"
              value={poolId}
              onChange={setPoolId}
            />
            <OperatorInput
              id="sports-create-outcomes"
              label="Outcomes"
              value={outcomeCount}
              onChange={setOutcomeCount}
            />
            <OperatorInput
              id="sports-create-finality"
              label="Finality seconds"
              value={resultFinalitySeconds}
              onChange={setResultFinalitySeconds}
            />
            <OperatorInput
              id="sports-create-start"
              label="Starts at unix"
              value={startsAt}
              onChange={setStartsAt}
            />
            <OperatorInput
              id="sports-create-lock"
              label="Lock time unix"
              value={lockTime}
              onChange={setLockTime}
            />
            <div className="sm:col-span-2">
              <OperatorInput
                id="sports-create-market-key"
                label="Market key"
                value={marketKey}
                onChange={setMarketKey}
                placeholder="0x..."
              />
            </div>
            <div className="sm:col-span-2">
              <OperatorInput
                id="sports-create-rulebook"
                label="Rulebook hash"
                value={rulebookHash}
                onChange={setRulebookHash}
                placeholder="0x..."
              />
            </div>
          </div>
          <div className="mt-5">
            <OperatorButton disabled={actionDisabled} onClick={createMarket}>
              Create market
            </OperatorButton>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-2/70 p-5">
          <div className="text-sm font-black text-fg">Lifecycle and result</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <OperatorInput
              id="sports-op-market"
              label="Target market id"
              value={marketId}
              onChange={setMarketId}
            />
            <OperatorInput
              id="sports-op-outcome"
              label="Winning outcome"
              value={winningOutcomeId}
              onChange={setWinningOutcomeId}
            />
            <div className="sm:col-span-2">
              <OperatorInput
                id="sports-op-source"
                label="Result source hash"
                value={resultSourceHash}
                onChange={setResultSourceHash}
                placeholder="0x..."
              />
            </div>
            <div className="sm:col-span-2">
              <OperatorInput
                id="sports-op-evidence"
                label="Evidence hash"
                value={evidenceHash}
                onChange={setEvidenceHash}
                placeholder="0x..."
              />
            </div>
            <OperatorInput
              id="sports-op-observed"
              label="Observed at unix"
              value={observedAt}
              onChange={setObservedAt}
            />
            <OperatorInput
              id="sports-op-void"
              label="Void reason hash"
              value={voidReasonHash}
              onChange={setVoidReasonHash}
              placeholder="0x..."
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <OperatorButton disabled={actionDisabled} onClick={openMarket}>
              Open
            </OperatorButton>
            <OperatorButton disabled={actionDisabled} onClick={lockMarket}>
              Lock
            </OperatorButton>
            <OperatorButton disabled={actionDisabled} onClick={proposeResult}>
              Propose result
            </OperatorButton>
            <OperatorButton disabled={actionDisabled} onClick={finalizeResult}>
              Finalize
            </OperatorButton>
            <OperatorButton disabled={actionDisabled} onClick={voidMarket} variant="danger">
              Void
            </OperatorButton>
          </div>
        </div>
      </div>
    </div>
  );
}

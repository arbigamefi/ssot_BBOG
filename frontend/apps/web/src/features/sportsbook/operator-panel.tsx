"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
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

type Translate = ReturnType<typeof useTranslations>;

function parsePositiveBigInt(value: string, label: string, t: Translate) {
  const parsed = parseLookupId(value);
  if (parsed === undefined || parsed <= 0n) {
    throw new Error(t("sportsbook.operator.validation.positiveInteger", { label }));
  }
  return parsed;
}

function parsePositiveNumber(value: string, label: string, t: Translate) {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(t("sportsbook.operator.validation.positiveInteger", { label }));
  }
  return parsed;
}

function parseBytes32(value: string, label: string, t: Translate) {
  const normalized = value.trim();
  if (!BYTES32_PATTERN.test(normalized)) {
    throw new Error(t("sportsbook.operator.validation.bytes32", { label }));
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
  const t = useTranslations();
  const [status, setStatus] = React.useState<OperatorStatus>({
    busy: false,
    label: t("sportsbook.operator.status.noTransaction")
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
  const [challengeReasonHash, setChallengeReasonHash] = React.useState("");
  const [decisionHash, setDecisionHash] = React.useState("");
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
        const message = result.error?.message ?? t("sportsbook.operator.status.failed", { label });
        setStatus({ busy: false, label, error: message });
        toast.error(message);
        return;
      }
      setStatus({ busy: false, label, txHash: result.txHash });
      toast.success(t("sportsbook.operator.status.submitted", { label }));
      onMutated?.();
    } catch (error) {
      const message = formatLookupError(error) ?? t("sportsbook.operator.status.failed", { label });
      setStatus({ busy: false, label, error: message });
      toast.error(message);
    }
  }

  const actionDisabled = disabled || status.busy || !sdk?.account;

  const createMarket = React.useCallback(() => {
    void run(t("sportsbook.operator.actions.createMarket"), async () => {
      if (!sdk) throw new Error(t("sportsbook.operator.status.sdkUnavailable"));
      return sdk.sportsHub.createMarket({
        eventId: parsePositiveBigInt(eventId, t("sportsbook.operator.fields.eventId"), t),
        poolId: parsePositiveNumber(poolId, t("sportsbook.operator.fields.poolId"), t),
        outcomeCount: parsePositiveNumber(
          outcomeCount,
          t("sportsbook.operator.fields.outcomeCount"),
          t
        ),
        startsAt: parsePositiveBigInt(startsAt, t("sportsbook.operator.fields.startsAt"), t),
        lockTime: parsePositiveBigInt(lockTime, t("sportsbook.operator.fields.lockTime"), t),
        resultFinalitySeconds: parsePositiveBigInt(
          resultFinalitySeconds,
          t("sportsbook.operator.fields.resultFinality"),
          t
        ),
        marketKey: parseBytes32(marketKey, t("sportsbook.operator.fields.marketKey"), t),
        rulebookHash: parseBytes32(rulebookHash, t("sportsbook.operator.fields.rulebookHash"), t)
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
    startsAt,
    t
  ]);

  const openMarket = React.useCallback(() => {
    void run(t("sportsbook.operator.actions.openMarket"), async () => {
      if (!sdk) throw new Error(t("sportsbook.operator.status.sdkUnavailable"));
      return sdk.sportsHub.openMarket(
        parsePositiveBigInt(marketId, t("sportsbook.operator.fields.marketId"), t)
      );
    });
  }, [marketId, sdk, t]);

  const lockMarket = React.useCallback(() => {
    void run(t("sportsbook.operator.actions.lockMarket"), async () => {
      if (!sdk) throw new Error(t("sportsbook.operator.status.sdkUnavailable"));
      return sdk.sportsHub.lockMarket(
        parsePositiveBigInt(marketId, t("sportsbook.operator.fields.marketId"), t)
      );
    });
  }, [marketId, sdk, t]);

  const proposeResult = React.useCallback(() => {
    void run(t("sportsbook.operator.actions.proposeResult"), async () => {
      if (!sdk) throw new Error(t("sportsbook.operator.status.sdkUnavailable"));
      return sdk.sportsHub.proposeResult({
        marketId: parsePositiveBigInt(marketId, t("sportsbook.operator.fields.marketId"), t),
        winningOutcomeId: parsePositiveNumber(
          winningOutcomeId,
          t("sportsbook.operator.fields.winningOutcome"),
          t
        ),
        resultSourceHash: parseBytes32(
          resultSourceHash,
          t("sportsbook.operator.fields.resultSourceHash"),
          t
        ),
        evidenceHash: parseBytes32(evidenceHash, t("sportsbook.operator.fields.evidenceHash"), t),
        observedAt: parsePositiveBigInt(observedAt, t("sportsbook.operator.fields.observedAt"), t)
      });
    });
  }, [evidenceHash, marketId, observedAt, resultSourceHash, sdk, t, winningOutcomeId]);

  const finalizeResult = React.useCallback(() => {
    void run(t("sportsbook.operator.actions.finalizeResult"), async () => {
      if (!sdk) throw new Error(t("sportsbook.operator.status.sdkUnavailable"));
      return sdk.sportsHub.finalizeResult(
        parsePositiveBigInt(marketId, t("sportsbook.operator.fields.marketId"), t)
      );
    });
  }, [marketId, sdk, t]);

  const challengeResult = React.useCallback(() => {
    void run(t("sportsbook.operator.actions.challengeResult"), async () => {
      if (!sdk) throw new Error(t("sportsbook.operator.status.sdkUnavailable"));
      return sdk.sportsHub.challengeResult(
        parsePositiveBigInt(marketId, t("sportsbook.operator.fields.marketId"), t),
        parseBytes32(challengeReasonHash, t("sportsbook.operator.fields.challengeReasonHash"), t)
      );
    });
  }, [challengeReasonHash, marketId, sdk, t]);

  const resolveChallenge = React.useCallback(
    (decision: "upholdResult" | "reopenResult" | "voidMarket") => {
      void run(t("sportsbook.operator.actions.resolveChallenge"), async () => {
        if (!sdk) throw new Error(t("sportsbook.operator.status.sdkUnavailable"));
        return sdk.sportsHub.resolveResultChallenge({
          marketId: parsePositiveBigInt(marketId, t("sportsbook.operator.fields.marketId"), t),
          decision,
          decisionHash: parseBytes32(decisionHash, t("sportsbook.operator.fields.decisionHash"), t)
        });
      });
    },
    [decisionHash, marketId, sdk, t]
  );

  const voidMarket = React.useCallback(() => {
    void run(t("sportsbook.operator.actions.voidMarket"), async () => {
      if (!sdk) throw new Error(t("sportsbook.operator.status.sdkUnavailable"));
      return sdk.sportsHub.voidMarket(
        parsePositiveBigInt(marketId, t("sportsbook.operator.fields.marketId"), t),
        parseBytes32(voidReasonHash, t("sportsbook.operator.fields.voidReasonHash"), t)
      );
    });
  }, [marketId, sdk, t, voidReasonHash]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <DetailCell
          label={t("sportsbook.operator.summary.writeStatus")}
          value={
            sdk?.account
              ? t("sportsbook.operator.summary.walletConnected")
              : t("sportsbook.operator.summary.walletRequired")
          }
          helper={disabledReason ?? t("sportsbook.operator.summary.rolesHelper")}
          mono={false}
        />
        <DetailCell
          label={t("sportsbook.operator.summary.lastAction")}
          value={status.label}
          helper={status.error}
          mono={false}
        />
        <DetailCell
          label={t("sportsbook.operator.summary.lastTx")}
          value={status.txHash ?? t("sportsbook.components.na")}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <StatusPill tone={disabled ? "warn" : "success"}>
          {disabled
            ? t("sportsbook.operator.summary.readOnly")
            : t("sportsbook.operator.summary.writable")}
        </StatusPill>
        <StatusPill tone={sdk?.account ? "success" : "warn"}>
          {sdk?.account
            ? t("sportsbook.operator.summary.walletConnected")
            : t("sportsbook.operator.summary.noWallet")}
        </StatusPill>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-2/70 p-5">
          <div className="text-sm font-black text-fg">{t("sportsbook.operator.create.title")}</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <OperatorInput
              id="sports-create-event"
              label={t("sportsbook.operator.fields.eventId")}
              value={eventId}
              onChange={setEventId}
            />
            <OperatorInput
              id="sports-create-pool"
              label={t("sportsbook.operator.fields.poolId")}
              value={poolId}
              onChange={setPoolId}
            />
            <OperatorInput
              id="sports-create-outcomes"
              label={t("sportsbook.operator.fields.outcomes")}
              value={outcomeCount}
              onChange={setOutcomeCount}
            />
            <OperatorInput
              id="sports-create-finality"
              label={t("sportsbook.operator.fields.finalitySeconds")}
              value={resultFinalitySeconds}
              onChange={setResultFinalitySeconds}
            />
            <OperatorInput
              id="sports-create-start"
              label={t("sportsbook.operator.fields.startsAtUnix")}
              value={startsAt}
              onChange={setStartsAt}
            />
            <OperatorInput
              id="sports-create-lock"
              label={t("sportsbook.operator.fields.lockTimeUnix")}
              value={lockTime}
              onChange={setLockTime}
            />
            <div className="sm:col-span-2">
              <OperatorInput
                id="sports-create-market-key"
                label={t("sportsbook.operator.fields.marketKey")}
                value={marketKey}
                onChange={setMarketKey}
                placeholder="0x..."
              />
            </div>
            <div className="sm:col-span-2">
              <OperatorInput
                id="sports-create-rulebook"
                label={t("sportsbook.operator.fields.rulebookHash")}
                value={rulebookHash}
                onChange={setRulebookHash}
                placeholder="0x..."
              />
            </div>
          </div>
          <div className="mt-5">
            <OperatorButton disabled={actionDisabled} onClick={createMarket}>
              {t("sportsbook.operator.actions.createMarket")}
            </OperatorButton>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-2/70 p-5">
          <div className="text-sm font-black text-fg">
            {t("sportsbook.operator.lifecycle.title")}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <OperatorInput
              id="sports-op-market"
              label={t("sportsbook.operator.fields.targetMarketId")}
              value={marketId}
              onChange={setMarketId}
            />
            <OperatorInput
              id="sports-op-outcome"
              label={t("sportsbook.operator.fields.winningOutcome")}
              value={winningOutcomeId}
              onChange={setWinningOutcomeId}
            />
            <div className="sm:col-span-2">
              <OperatorInput
                id="sports-op-source"
                label={t("sportsbook.operator.fields.resultSourceHash")}
                value={resultSourceHash}
                onChange={setResultSourceHash}
                placeholder="0x..."
              />
            </div>
            <div className="sm:col-span-2">
              <OperatorInput
                id="sports-op-evidence"
                label={t("sportsbook.operator.fields.evidenceHash")}
                value={evidenceHash}
                onChange={setEvidenceHash}
                placeholder="0x..."
              />
            </div>
            <OperatorInput
              id="sports-op-observed"
              label={t("sportsbook.operator.fields.observedAtUnix")}
              value={observedAt}
              onChange={setObservedAt}
            />
            <OperatorInput
              id="sports-op-void"
              label={t("sportsbook.operator.fields.voidReasonHash")}
              value={voidReasonHash}
              onChange={setVoidReasonHash}
              placeholder="0x..."
            />
            <div className="sm:col-span-2">
              <OperatorInput
                id="sports-op-challenge"
                label={t("sportsbook.operator.fields.challengeReasonHash")}
                value={challengeReasonHash}
                onChange={setChallengeReasonHash}
                placeholder="0x..."
              />
            </div>
            <div className="sm:col-span-2">
              <OperatorInput
                id="sports-op-decision"
                label={t("sportsbook.operator.fields.arbitrationDecisionHash")}
                value={decisionHash}
                onChange={setDecisionHash}
                placeholder="0x..."
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <OperatorButton disabled={actionDisabled} onClick={openMarket}>
              {t("sportsbook.operator.buttons.open")}
            </OperatorButton>
            <OperatorButton disabled={actionDisabled} onClick={lockMarket}>
              {t("sportsbook.operator.buttons.lock")}
            </OperatorButton>
            <OperatorButton disabled={actionDisabled} onClick={proposeResult}>
              {t("sportsbook.operator.buttons.proposeResult")}
            </OperatorButton>
            <OperatorButton disabled={actionDisabled} onClick={finalizeResult}>
              {t("sportsbook.operator.buttons.finalize")}
            </OperatorButton>
            <OperatorButton disabled={actionDisabled} onClick={challengeResult}>
              {t("sportsbook.operator.buttons.challenge")}
            </OperatorButton>
            <OperatorButton
              disabled={actionDisabled}
              onClick={() => resolveChallenge("upholdResult")}
            >
              {t("sportsbook.operator.buttons.uphold")}
            </OperatorButton>
            <OperatorButton
              disabled={actionDisabled}
              onClick={() => resolveChallenge("reopenResult")}
            >
              {t("sportsbook.operator.buttons.reopen")}
            </OperatorButton>
            <OperatorButton
              disabled={actionDisabled}
              onClick={() => resolveChallenge("voidMarket")}
            >
              {t("sportsbook.operator.buttons.voidChallenged")}
            </OperatorButton>
            <OperatorButton disabled={actionDisabled} onClick={voidMarket} variant="danger">
              {t("sportsbook.operator.buttons.void")}
            </OperatorButton>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
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
  providerEventId: string;
  bookmakerKey: string;
  sportKey: string;
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
  providerEventId: "",
  bookmakerKey: "",
  sportKey: "soccer_fifa_world_cup",
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

type SignedOddsSnapshotResponse = {
  provider: {
    providerEventId?: string;
    bookmakerKey?: string;
    sportKey?: string;
  };
  outcome: {
    name: string;
    decimalPrice: string;
    oddsWad: string;
  };
  stake: string;
  payout: string;
  odds: {
    oddsWad: string;
    maxStake: string;
    maxPayout: string;
    expiresAt: string;
    nonce: string;
    riskHash: string;
  };
  oddsTicketHash: string;
  signature: string;
};

type Translate = ReturnType<typeof useTranslations>;

function parsePositiveBigInt(value: string, label: string, t: Translate) {
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    throw new Error(t("sportsbook.ticketPlacement.validation.positiveInteger", { label }));
  }
  const parsed = BigInt(trimmed);
  if (parsed <= 0n) {
    throw new Error(t("sportsbook.ticketPlacement.validation.greaterThanZero", { label }));
  }
  return parsed;
}

function parseNonNegativeBigInt(value: string, label: string, t: Translate) {
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    throw new Error(t("sportsbook.ticketPlacement.validation.integer", { label }));
  }
  return BigInt(trimmed);
}

function parseOutcomeId(value: string, market: DomainSportsMarket, t: Translate) {
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    throw new Error(t("sportsbook.ticketPlacement.validation.outcomeNonNegative"));
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(t("sportsbook.ticketPlacement.validation.outcomeTooLarge"));
  }
  if (parsed < 0 || parsed >= market.outcomeCount) {
    throw new Error(
      t("sportsbook.ticketPlacement.validation.outcomeRange", {
        max: String(market.outcomeCount - 1)
      })
    );
  }
  return parsed;
}

function parseHex(value: string, label: string, t: Translate, exactBytes?: number) {
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]*$/.test(trimmed)) {
    throw new Error(t("sportsbook.ticketPlacement.validation.hex", { label }));
  }
  if (exactBytes !== undefined && trimmed.length !== 2 + exactBytes * 2) {
    throw new Error(
      t("sportsbook.ticketPlacement.validation.exactBytes", {
        label,
        bytes: String(exactBytes)
      })
    );
  }
  return trimmed as `0x${string}`;
}

function getPoolRiskHash(release: SSOTRelease, poolId: number) {
  return release.pools.find((pool) => pool.poolId === poolId)?.sportsRisk?.riskHash;
}

function makeInput(
  chainId: number,
  market: DomainSportsMarket,
  form: TicketPlacementForm,
  t: Translate
): PlaceSportsTicketInput {
  const outcomeId = parseOutcomeId(form.outcomeId, market, t);
  const odds: SportsOddsSnapshotInput = {
    marketId: market.marketId,
    outcomeId,
    marketVersion: market.version,
    oddsWad: parsePositiveBigInt(form.oddsWad, t("sportsbook.ticketPlacement.fields.oddsWad"), t),
    maxStake: parsePositiveBigInt(
      form.maxStake,
      t("sportsbook.ticketPlacement.fields.maxStake"),
      t
    ),
    maxPayout: parsePositiveBigInt(
      form.maxPayout,
      t("sportsbook.ticketPlacement.fields.maxPayout"),
      t
    ),
    expiresAt: parsePositiveBigInt(
      form.expiresAt,
      t("sportsbook.ticketPlacement.fields.expiresAt"),
      t
    ),
    nonce: parseNonNegativeBigInt(form.nonce, t("sportsbook.ticketPlacement.fields.nonce"), t),
    riskHash: parseHex(form.riskHash, t("sportsbook.ticketPlacement.fields.riskHash"), t, 32)
  };

  return {
    chainId,
    marketId: market.marketId,
    outcomeId,
    stake: parsePositiveBigInt(form.stake, t("sportsbook.ticketPlacement.fields.stake"), t),
    odds,
    signature: parseHex(form.signature, t("sportsbook.ticketPlacement.fields.signature"), t)
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
  const t = useTranslations();
  const defaultRiskHash = getPoolRiskHash(release, market.poolId) ?? "";
  const [form, setForm] = React.useState<TicketPlacementForm>({
    ...EMPTY_FORM,
    riskHash: defaultRiskHash
  });
  const [plan, setPlan] = React.useState<PlaceSportsTicketPlan | undefined>();
  const [status, setStatus] = React.useState<TicketPlacementStatus>({
    busy: false,
    label: t("sportsbook.ticketPlacement.status.noPlan")
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
    const input = makeInput(chainId, market, form, t);
    const result = await sdk.sportsHub.planPlaceTicket(input);
    if ("error" in result) {
      throw new Error(result.error.message);
    }
    setPlan(result);
    return result;
  }, [chainId, form, market, sdk, t]);

  const onPlan = React.useCallback(async () => {
    try {
      setStatus({ busy: true, label: t("sportsbook.ticketPlacement.status.planning") });
      const nextPlan = await buildPlan();
      setStatus({
        busy: false,
        label: nextPlan?.preview.needsApproval
          ? t("sportsbook.ticketPlacement.status.planReadyApproval")
          : t("sportsbook.ticketPlacement.status.planReady")
      });
    } catch (error) {
      const message =
        formatLookupError(error) ?? t("sportsbook.ticketPlacement.status.ticketPlanningFailed");
      setStatus({
        busy: false,
        label: t("sportsbook.ticketPlacement.status.planningFailed"),
        error: message
      });
      toast.error(message);
    }
  }, [buildPlan, t]);

  const onFetchProviderOdds = React.useCallback(async () => {
    if (!sdk?.account) return;
    try {
      const outcomeId = parseOutcomeId(form.outcomeId, market, t);
      const stake = parsePositiveBigInt(
        form.stake,
        t("sportsbook.ticketPlacement.fields.stake"),
        t
      );
      setStatus({ busy: true, label: t("sportsbook.ticketPlacement.status.fetchingProviderOdds") });
      const response = await fetch("/api/sportsbook/odds-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId,
          marketId: market.marketId.toString(),
          outcomeId,
          player: sdk.account,
          stake: stake.toString(),
          providerEventId: form.providerEventId.trim() || undefined,
          bookmakerKey: form.bookmakerKey.trim() || undefined,
          sportKey: form.sportKey.trim() || undefined
        })
      });
      const body = (await response.json()) as
        | SignedOddsSnapshotResponse
        | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(t("sportsbook.ticketPlacement.status.providerOddsRequestFailed"));
      }
      const signed = body as SignedOddsSnapshotResponse;
      setForm((current) => ({
        ...current,
        providerEventId: signed.provider.providerEventId ?? current.providerEventId,
        bookmakerKey: signed.provider.bookmakerKey ?? current.bookmakerKey,
        sportKey: signed.provider.sportKey ?? current.sportKey,
        stake: signed.stake,
        oddsWad: signed.odds.oddsWad,
        maxStake: signed.odds.maxStake,
        maxPayout: signed.odds.maxPayout,
        expiresAt: signed.odds.expiresAt,
        nonce: signed.odds.nonce,
        riskHash: signed.odds.riskHash,
        signature: signed.signature
      }));
      setPlan(undefined);
      setStatus({
        busy: false,
        label: t("sportsbook.ticketPlacement.status.signedOddsReady", {
          outcome: signed.outcome.name,
          price: signed.outcome.decimalPrice
        }),
        txHash: signed.oddsTicketHash
      });
      toast.success(t("sportsbook.ticketPlacement.status.providerOddsReadyToast"));
    } catch (error) {
      const message =
        formatLookupError(error) ??
        t("sportsbook.ticketPlacement.status.providerOddsRequestFailed");
      setStatus({
        busy: false,
        label: t("sportsbook.ticketPlacement.status.providerOddsFailed"),
        error: message
      });
      toast.error(message);
    }
  }, [chainId, form, market, sdk?.account, t]);

  const onPlace = React.useCallback(async () => {
    if (!sdk) return;
    try {
      setStatus({ busy: true, label: t("sportsbook.ticketPlacement.status.submittingTicket") });
      const executablePlan = plan ?? (await buildPlan());
      if (!executablePlan) {
        throw new Error(t("sportsbook.ticketPlacement.status.planUnavailable"));
      }
      const result = await sdk.sportsHub.executeTicketPlan(executablePlan);
      if (!result.placeTicketTx.ok) {
        const message =
          result.placeTicketTx.error?.message ??
          t("sportsbook.ticketPlacement.status.ticketPlacementFailed");
        setStatus({
          busy: false,
          label: t("sportsbook.ticketPlacement.status.ticketFailed"),
          error: message
        });
        toast.error(message);
        return;
      }
      setStatus({
        busy: false,
        label: result.ticketId
          ? t("sportsbook.ticketPlacement.status.ticketSubmittedWithId", {
              ticketId: result.ticketId.toString()
            })
          : t("sportsbook.ticketPlacement.status.ticketSubmitted"),
        txHash: result.placeTicketTx.txHash
      });
      toast.success(t("sportsbook.ticketPlacement.status.ticketSubmittedToast"));
      onMutated?.();
    } catch (error) {
      const message =
        formatLookupError(error) ?? t("sportsbook.ticketPlacement.status.ticketPlacementFailed");
      setStatus({
        busy: false,
        label: t("sportsbook.ticketPlacement.status.ticketFailed"),
        error: message
      });
      toast.error(message);
    }
  }, [buildPlan, onMutated, plan, sdk, t]);

  const actionDisabled = disabled || status.busy || !sdk?.account || market.state !== "open";

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailCell
          label={t("sportsbook.ticketPlacement.summary.gate")}
          value={
            disabled
              ? t("sportsbook.ticketPlacement.summary.locked")
              : t("sportsbook.ticketPlacement.summary.enabled")
          }
          helper={disabledReason ?? t("sportsbook.ticketPlacement.summary.gateHelper")}
          mono={false}
        />
        <DetailCell
          label={t("sportsbook.ticketPlacement.summary.market")}
          value={`${market.state} / v${market.version.toString()}`}
          helper={t("sportsbook.ticketPlacement.summary.marketHelper", {
            poolId: String(market.poolId),
            outcomeCount: String(market.outcomeCount)
          })}
          mono={false}
        />
        <DetailCell
          label={t("sportsbook.ticketPlacement.summary.status")}
          value={status.label}
          helper={status.error}
          mono={false}
        />
        <DetailCell
          label={t("sportsbook.ticketPlacement.summary.lastTx")}
          value={status.txHash ?? t("sportsbook.components.na")}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface-2/70 p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field
            id="sports-ticket-provider-event"
            label={t("sportsbook.ticketPlacement.fields.providerEventId")}
            value={form.providerEventId}
            onChange={(value) => update("providerEventId", value)}
            placeholder={t("sportsbook.ticketPlacement.placeholders.optional")}
          />
          <Field
            id="sports-ticket-bookmaker"
            label={t("sportsbook.ticketPlacement.fields.bookmakerKey")}
            value={form.bookmakerKey}
            onChange={(value) => update("bookmakerKey", value)}
            placeholder={t("sportsbook.ticketPlacement.placeholders.optional")}
          />
          <Field
            id="sports-ticket-sport"
            label={t("sportsbook.ticketPlacement.fields.sportKey")}
            value={form.sportKey}
            onChange={(value) => update("sportKey", value)}
            placeholder="soccer_fifa_world_cup"
          />
          <Field
            id="sports-ticket-outcome"
            label={t("sportsbook.ticketPlacement.fields.outcomeId")}
            value={form.outcomeId}
            onChange={(value) => update("outcomeId", value)}
            placeholder="0"
          />
          <Field
            id="sports-ticket-stake"
            label={t("sportsbook.ticketPlacement.fields.stakeRawUnits")}
            value={form.stake}
            onChange={(value) => update("stake", value)}
            placeholder="1000000"
          />
          <Field
            id="sports-ticket-odds"
            label={t("sportsbook.ticketPlacement.fields.oddsWad")}
            value={form.oddsWad}
            onChange={(value) => update("oddsWad", value)}
            placeholder="2100000000000000000"
          />
          <Field
            id="sports-ticket-max-stake"
            label={t("sportsbook.ticketPlacement.fields.maxStake")}
            value={form.maxStake}
            onChange={(value) => update("maxStake", value)}
            placeholder="2000000"
          />
          <Field
            id="sports-ticket-max-payout"
            label={t("sportsbook.ticketPlacement.fields.maxPayout")}
            value={form.maxPayout}
            onChange={(value) => update("maxPayout", value)}
            placeholder="4200000"
          />
          <Field
            id="sports-ticket-expires"
            label={t("sportsbook.ticketPlacement.fields.expiresAt")}
            value={form.expiresAt}
            onChange={(value) => update("expiresAt", value)}
            placeholder={t("sportsbook.ticketPlacement.placeholders.unixSeconds")}
          />
          <Field
            id="sports-ticket-nonce"
            label={t("sportsbook.ticketPlacement.fields.nonce")}
            value={form.nonce}
            onChange={(value) => update("nonce", value)}
            placeholder="0"
          />
          <div className="xl:col-span-2">
            <Field
              id="sports-ticket-risk-hash"
              label={t("sportsbook.ticketPlacement.fields.riskHash")}
              value={form.riskHash}
              onChange={(value) => update("riskHash", value)}
              placeholder="0x..."
            />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <Field
              id="sports-ticket-signature"
              label={t("sportsbook.ticketPlacement.fields.oddsSignature")}
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
            onClick={onFetchProviderOdds}
            className="min-h-11 rounded-md border border-brand/30 bg-brand-soft px-4 text-sm font-black text-brand transition-colors hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("sportsbook.ticketPlacement.actions.fetchSignedOdds")}
          </button>
          <button
            type="button"
            disabled={actionDisabled}
            onClick={onPlan}
            className="min-h-11 rounded-md border border-border bg-surface-1 px-4 text-sm font-black text-fg transition-colors hover:border-brand/40 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("sportsbook.ticketPlacement.actions.planTicket")}
          </button>
          <button
            type="button"
            disabled={actionDisabled}
            onClick={onPlace}
            className="min-h-11 rounded-md bg-brand px-4 text-sm font-black text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("sportsbook.ticketPlacement.actions.placeTicket")}
          </button>
        </div>

        {status.error ? (
          <div className="mt-3 text-xs leading-5 text-danger">{status.error}</div>
        ) : null}
        {!sdk?.account ? (
          <div className="mt-3 text-xs leading-5 text-warn">
            {t("sportsbook.ticketPlacement.walletRequired")}
          </div>
        ) : null}
      </div>

      {plan ? (
        <div className="grid gap-4 md:grid-cols-3">
          <DetailCell
            label={t("sportsbook.ticketPlacement.plan.approval")}
            value={
              plan.preview.needsApproval
                ? t("sportsbook.ticketPlacement.plan.required")
                : t("sportsbook.ticketPlacement.plan.notRequired")
            }
            helper={
              plan.preview.needsApproval
                ? t("sportsbook.ticketPlacement.plan.approveAmount", {
                    amount: plan.preview.approveAmount?.toString() ?? "0"
                  })
                : t("sportsbook.ticketPlacement.plan.allowance", {
                    amount: plan.preview.allowance.toString()
                  })
            }
            mono={false}
          />
          <DetailCell
            label={t("sportsbook.ticketPlacement.plan.oddsTicketHash")}
            value={shortHex(plan.preview.oddsTicketHash)}
          />
          <DetailCell
            label={t("sportsbook.ticketPlacement.plan.planState")}
            value={status.label}
            helper={status.error}
            mono={false}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-sm leading-6 text-fg-muted">
          {t("sportsbook.ticketPlacement.plan.empty")}
        </div>
      )}
    </div>
  );
}

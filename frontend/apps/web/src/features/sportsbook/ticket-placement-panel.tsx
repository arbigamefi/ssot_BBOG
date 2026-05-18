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
import { providerOutcomeById, type SportsbookProviderOdds } from "./provider-odds";

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

const DEFAULT_SPORT_KEY = process.env.NEXT_PUBLIC_SPORTS_PROVIDER_SPORT_KEY ?? "soccer_usa_mls";

const EMPTY_FORM: TicketPlacementForm = {
  providerEventId: "",
  bookmakerKey: "",
  sportKey: DEFAULT_SPORT_KEY,
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

function parseDecimalUnits(value: string, decimals: number, label: string, t: Translate) {
  const trimmed = value.trim();
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(trimmed)) {
    throw new Error(t("sportsbook.ticketPlacement.validation.positiveAmount", { label }));
  }
  const [wholePart, fraction = ""] = trimmed.split(".");
  const whole = wholePart ?? "0";
  if (fraction.length > decimals) {
    throw new Error(
      t("sportsbook.ticketPlacement.validation.decimals", {
        label,
        decimals: String(decimals)
      })
    );
  }
  const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0"));
  if (raw <= 0n) {
    throw new Error(t("sportsbook.ticketPlacement.validation.greaterThanZero", { label }));
  }
  return raw;
}

function formatUnits(value: string | bigint | undefined, decimals: number) {
  if (value === undefined) return "—";
  const raw = typeof value === "bigint" ? value : BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = raw % scale;
  if (fraction === 0n) return whole.toString();
  return `${whole.toString()}.${fraction.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

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

function getPoolAsset(release: SSOTRelease, poolId: number) {
  const pool = release.pools.find((item) => item.poolId === poolId);
  return {
    symbol: pool?.symbol ?? "USDC",
    decimals: typeof pool?.decimals === "number" ? pool.decimals : 6
  };
}

function defaultOutcomeLabel(outcomeId: number, market: DomainSportsMarket, t: Translate) {
  if (market.outcomeCount === 3) {
    if (outcomeId === 0) return t("sportsbook.ticketPlacement.outcomes.home");
    if (outcomeId === 1) return t("sportsbook.ticketPlacement.outcomes.draw");
    if (outcomeId === 2) return t("sportsbook.ticketPlacement.outcomes.away");
  }
  if (market.outcomeCount === 2) {
    if (outcomeId === 0) return t("sportsbook.ticketPlacement.outcomes.home");
    if (outcomeId === 1) return t("sportsbook.ticketPlacement.outcomes.away");
  }
  return t("sportsbook.ticketPlacement.outcomes.generic", { outcomeId: String(outcomeId) });
}

function makeInput(
  chainId: number,
  market: DomainSportsMarket,
  form: TicketPlacementForm,
  assetDecimals: number,
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
    stake: parseDecimalUnits(
      form.stake,
      assetDecimals,
      t("sportsbook.ticketPlacement.fields.stake"),
      t
    ),
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
  providerOdds,
  initialOutcomeId,
  disabled,
  disabledReason,
  onMutated
}: {
  sdk?: SSOTSDK;
  release: SSOTRelease;
  chainId: number;
  market: DomainSportsMarket;
  providerOdds?: SportsbookProviderOdds;
  initialOutcomeId?: string;
  disabled: boolean;
  disabledReason?: string;
  onMutated?: () => void;
}) {
  const t = useTranslations();
  const defaultRiskHash = getPoolRiskHash(release, market.poolId) ?? "";
  const poolAsset = getPoolAsset(release, market.poolId);
  const [form, setForm] = React.useState<TicketPlacementForm>({
    ...EMPTY_FORM,
    riskHash: defaultRiskHash
  });
  const [signedOdds, setSignedOdds] = React.useState<SignedOddsSnapshotResponse | undefined>();
  const [plan, setPlan] = React.useState<PlaceSportsTicketPlan | undefined>();
  const [status, setStatus] = React.useState<TicketPlacementStatus>({
    busy: false,
    label: t("sportsbook.ticketPlacement.status.noPlan")
  });

  React.useEffect(() => {
    const nextOutcomeId =
      initialOutcomeId && /^[0-9]+$/.test(initialOutcomeId)
        ? Math.min(Number(initialOutcomeId), market.outcomeCount - 1).toString()
        : "0";
    setForm((current) => ({
      ...current,
      outcomeId: nextOutcomeId,
      riskHash: getPoolRiskHash(release, market.poolId) ?? ""
    }));
    setPlan(undefined);
    setSignedOdds(undefined);
  }, [initialOutcomeId, market.marketId, market.outcomeCount, market.poolId, release]);

  React.useEffect(() => {
    if (!providerOdds) return;
    setForm((current) => ({
      ...current,
      providerEventId: providerOdds.provider.providerEventId || current.providerEventId,
      bookmakerKey: providerOdds.provider.bookmakerKey ?? current.bookmakerKey,
      sportKey: providerOdds.provider.sportKey || current.sportKey
    }));
  }, [providerOdds]);

  const update = React.useCallback((key: keyof TicketPlacementForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setPlan(undefined);
    if (["outcomeId", "stake", "providerEventId", "bookmakerKey", "sportKey"].includes(key)) {
      setSignedOdds(undefined);
    }
  }, []);

  const buildPlan = React.useCallback(async () => {
    if (!sdk) return undefined;
    const input = makeInput(chainId, market, form, poolAsset.decimals, t);
    const result = await sdk.sportsHub.planPlaceTicket(input);
    if ("error" in result) {
      throw new Error(result.error.message);
    }
    setPlan(result);
    return result;
  }, [chainId, form, market, poolAsset.decimals, sdk, t]);

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
      const stake = parseDecimalUnits(
        form.stake,
        poolAsset.decimals,
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
        oddsWad: signed.odds.oddsWad,
        maxStake: signed.odds.maxStake,
        maxPayout: signed.odds.maxPayout,
        expiresAt: signed.odds.expiresAt,
        nonce: signed.odds.nonce,
        riskHash: signed.odds.riskHash,
        signature: signed.signature
      }));
      setSignedOdds(signed);
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
  }, [chainId, form, market, poolAsset.decimals, sdk?.account, t]);

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
  const hasSignedOdds = Boolean(form.signature && form.oddsWad && form.maxStake && form.maxPayout);
  const hasStake = form.stake.trim().length > 0;
  const canFetchOdds = !actionDisabled && hasStake;
  const canPlaceTicket = !actionDisabled && hasSignedOdds;
  const canReviewPlan = canPlaceTicket;
  const selectedOutcomeId = Number(form.outcomeId);
  const selectedOutcomeName = Number.isSafeInteger(selectedOutcomeId)
    ? defaultOutcomeLabel(selectedOutcomeId, market, t)
    : t("sportsbook.ticketPlacement.outcomes.generic", { outcomeId: form.outcomeId || "0" });
  const actionHint = !sdk?.account
    ? t("sportsbook.ticketPlacement.walletRequired")
    : disabled
      ? disabledReason
      : market.state !== "open"
        ? t("sportsbook.detail.ticketPlacement.marketMustBeOpen")
        : !hasStake
          ? t("sportsbook.ticketPlacement.hints.enterStake")
          : !hasSignedOdds
            ? t("sportsbook.ticketPlacement.hints.getLiveOdds")
            : t("sportsbook.ticketPlacement.hints.readyToPlace");

  return (
    <div className="grid gap-5">
      <div className="rounded-md border border-border bg-surface-1/70 p-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="font-bold uppercase tracking-[0.16em] text-fg-subtle">
              {t("sportsbook.ticketPlacement.summary.gate")}
            </div>
            <div className="mt-1 font-semibold text-fg">
              {disabled
                ? t("sportsbook.ticketPlacement.summary.locked")
                : t("sportsbook.ticketPlacement.summary.enabled")}
            </div>
          </div>
          <div>
            <div className="font-bold uppercase tracking-[0.16em] text-fg-subtle">
              {t("sportsbook.ticketPlacement.summary.market")}
            </div>
            <div className="mt-1 font-semibold text-fg">{`${market.state} / v${market.version.toString()}`}</div>
          </div>
          <div>
            <div className="font-bold uppercase tracking-[0.16em] text-fg-subtle">
              {t("sportsbook.ticketPlacement.summary.status")}
            </div>
            <div className="mt-1 font-semibold text-fg">{status.label}</div>
          </div>
          <div>
            <div className="font-bold uppercase tracking-[0.16em] text-fg-subtle">
              {t("sportsbook.ticketPlacement.summary.lastTx")}
            </div>
            <div className="mt-1 font-mono font-semibold text-fg">
              {status.txHash ? shortHex(status.txHash) : t("sportsbook.components.na")}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-2/70 p-5">
        <div className="grid gap-4">
          <div className="grid gap-5">
            <div className="grid gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
                  {t("sportsbook.ticketPlacement.sections.selection")}
                </div>
                <div className="mt-1 text-sm text-fg-muted">
                  {t("sportsbook.ticketPlacement.sections.selectionHelper")}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {Array.from({ length: market.outcomeCount }, (_, outcomeId) => {
                  const selected = form.outcomeId === String(outcomeId);
                  const signedForOutcome =
                    signedOdds && Number(form.outcomeId) === outcomeId
                      ? signedOdds.outcome
                      : undefined;
                  const providerOutcome = providerOutcomeById(providerOdds, outcomeId);
                  return (
                    <button
                      key={outcomeId}
                      type="button"
                      onClick={() => update("outcomeId", String(outcomeId))}
                      className={[
                        "min-h-20 rounded-md border p-3 text-left transition-colors",
                        selected
                          ? "border-brand bg-brand-soft text-brand"
                          : "border-border bg-surface-1 text-fg hover:border-brand/40"
                      ].join(" ")}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
                        {t("sportsbook.ticketPlacement.outcomes.option", {
                          outcomeId: String(outcomeId)
                        })}
                      </div>
                      <div className="mt-2 text-base font-black">
                        {signedForOutcome?.name ??
                          providerOutcome?.name ??
                          defaultOutcomeLabel(outcomeId, market, t)}
                      </div>
                      {signedForOutcome || providerOutcome ? (
                        <div className="mt-1 font-mono text-xs">
                          {t("sportsbook.ticketPlacement.outcomes.price", {
                            price:
                              signedForOutcome?.decimalPrice ?? providerOutcome?.decimalPrice ?? "—"
                          })}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4">
              <Field
                id="sports-ticket-stake"
                label={t("sportsbook.ticketPlacement.fields.stakeWithSymbol", {
                  symbol: poolAsset.symbol
                })}
                value={form.stake}
                onChange={(value) => update("stake", value)}
                placeholder="1.00"
                mono={false}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <button
                type="button"
                disabled={!canFetchOdds}
                onClick={onFetchProviderOdds}
                className={[
                  "min-h-12 rounded-md px-4 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  hasSignedOdds
                    ? "border border-border bg-surface-1 text-fg hover:border-brand/40 hover:bg-surface-3"
                    : "border border-brand/30 bg-brand-soft text-brand hover:border-brand/50"
                ].join(" ")}
              >
                {hasSignedOdds
                  ? t("sportsbook.ticketPlacement.actions.refreshOdds")
                  : t("sportsbook.ticketPlacement.actions.fetchSignedOdds")}
              </button>
              <button
                type="button"
                disabled={!canPlaceTicket}
                onClick={onPlace}
                className="min-h-12 rounded-md bg-brand px-4 text-sm font-black text-fg-inverse shadow-glow transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("sportsbook.ticketPlacement.actions.placeTicket")}
              </button>
            </div>
            {actionHint ? (
              <div className="text-xs leading-5 text-fg-muted">{actionHint}</div>
            ) : null}
            {status.error ? (
              <div className="text-xs leading-5 text-danger">{status.error}</div>
            ) : null}

            <details className="rounded-md border border-border bg-surface-1 p-4">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-fg-muted">
                {t("sportsbook.ticketPlacement.sections.advanced")}
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field
                  id="sports-ticket-sport"
                  label={t("sportsbook.ticketPlacement.fields.sportKey")}
                  value={form.sportKey}
                  onChange={(value) => update("sportKey", value)}
                  placeholder="soccer_usa_mls"
                />
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
              <div className="mt-4 grid gap-3 rounded-md border border-border-soft bg-surface-0 p-3 text-xs leading-5 text-fg-muted md:grid-cols-[1fr_auto] md:items-center">
                <div>{t("sportsbook.ticketPlacement.plan.advancedHelper")}</div>
                <button
                  type="button"
                  disabled={!canReviewPlan}
                  onClick={onPlan}
                  className="min-h-10 rounded-md border border-border bg-surface-1 px-3 text-xs font-black text-fg transition-colors hover:border-brand/40 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("sportsbook.ticketPlacement.actions.planTicket")}
                </button>
              </div>
            </details>
          </div>

          <div className="grid content-start gap-3 rounded-md border border-border bg-surface-0 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
              {t("sportsbook.ticketPlacement.sections.ticketPreview")}
            </div>
            <div className="grid gap-3">
              <DetailCell
                label={t("sportsbook.ticketPlacement.preview.selection")}
                value={
                  signedOdds?.outcome.name ??
                  providerOutcomeById(providerOdds, selectedOutcomeId)?.name ??
                  selectedOutcomeName
                }
                helper={
                  signedOdds
                    ? t("sportsbook.ticketPlacement.preview.provider", {
                        sport: (signedOdds.provider.sportKey ?? form.sportKey) || "—",
                        bookmaker: (signedOdds.provider.bookmakerKey ?? form.bookmakerKey) || "—"
                      })
                    : providerOdds
                      ? t("sportsbook.ticketPlacement.preview.provider", {
                          sport: providerOdds.provider.sportKey,
                          bookmaker:
                            providerOdds.provider.bookmakerTitle ??
                            providerOdds.provider.bookmakerKey ??
                            "—"
                        })
                      : t("sportsbook.ticketPlacement.preview.needsOdds")
                }
                mono={false}
              />
              <DetailCell
                label={t("sportsbook.ticketPlacement.preview.price")}
                value={
                  signedOdds?.outcome.decimalPrice ??
                  providerOutcomeById(providerOdds, selectedOutcomeId)?.decimalPrice ??
                  "—"
                }
                helper={
                  signedOdds
                    ? t("sportsbook.ticketPlacement.preview.priceHelper")
                    : providerOdds
                      ? t("sportsbook.ticketPlacement.preview.publicPriceHelper")
                      : t("sportsbook.ticketPlacement.preview.priceHelper")
                }
                mono={false}
              />
              <DetailCell
                label={t("sportsbook.ticketPlacement.preview.payout")}
                value={
                  signedOdds
                    ? `${formatUnits(signedOdds.payout, poolAsset.decimals)} ${poolAsset.symbol}`
                    : "—"
                }
                helper={t("sportsbook.ticketPlacement.preview.payoutHelper")}
                mono={false}
              />
            </div>
            <div
              className={[
                "rounded-md border p-3 text-xs leading-5",
                hasSignedOdds
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-border bg-surface-1 text-fg-muted"
              ].join(" ")}
            >
              {hasSignedOdds
                ? t("sportsbook.ticketPlacement.preview.priceLocked")
                : t("sportsbook.ticketPlacement.preview.priceNotLocked")}
            </div>
          </div>
        </div>
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

import { formatUnits } from "../betting/model/units";
import type { GovernanceArgValue, GovernanceCallView } from "./types";

type Translate = (key: string, values?: Record<string, string | number>) => string;

export type GovernanceReleaseContext = {
  pools: readonly { poolId: number; asset: string; symbol?: string; decimals?: number }[];
  assets: readonly { address: string; symbol: string; decimals: number }[];
  gamesMeta?: readonly { gameId: string; label: string }[];
};

export type GovernanceLine = {
  text: string;
  /**
   * Changes who controls the protocol or how long LPs get to react (governance, roles, delay,
   * guardian, sentinel), or cannot be decoded at all.
   */
  critical: boolean;
  /** The target or selector is not a release contract call; the line names target and selector. */
  unknown: boolean;
};

/** ADR-0037 §2–§3: these change who controls the protocol or how long LPs get to react. */
const CRITICAL_FUNCTIONS = new Set([
  "transferGovernance",
  "acceptGovernance",
  "grantRole",
  "revokeRole",
  "renounceRole",
  "updateDelay",
  "setGuardian",
  "setSentinel"
]);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function shortAddress(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

/** Basis points as a percentage in the reader's locale, e.g. 250 → "2.5%". */
export function formatBps(bps: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(
    Number(bps) / 10_000
  );
}

/** Whole seconds in the largest exact unit; up to a week reads in hours (72 hours, not 3 days). */
export function formatDuration(seconds: string, locale: string) {
  const value = BigInt(seconds);
  const unit =
    value >= 604_800n && value % 86_400n === 0n
      ? (["day", 86_400n] as const)
      : value > 0n && value % 3_600n === 0n
        ? (["hour", 3_600n] as const)
        : value > 0n && value % 60n === 0n
          ? (["minute", 60n] as const)
          : (["second", 1n] as const);
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: unit[0],
    unitDisplay: "long"
  }).format(Number(value / unit[1]));
}

function formatAmount(raw: string, decimals: number, symbol: string) {
  const [whole = "0", fraction = ""] = formatUnits(BigInt(raw), decimals).split(".");
  const trimmed = fraction.slice(0, 6).replace(/0+$/, "");
  return `${BigInt(whole).toLocaleString("en-US")}${trimmed ? `.${trimmed}` : ""} ${symbol}`;
}

function text(value: GovernanceArgValue | undefined) {
  return typeof value === "string" ? value : String(value ?? "");
}

/**
 * One human-readable line per timelock call. Known calls use a template; a known but untemplated
 * function names its signature; anything else names the target and selector.
 */
export function describeGovernanceCall(
  call: GovernanceCallView,
  release: GovernanceReleaseContext,
  locale: string,
  t: Translate
): GovernanceLine {
  const fn = call.function;
  if (!fn) {
    return {
      text: call.selector
        ? t("governance.calls.unknown", {
            target: shortAddress(call.target),
            selector: call.selector
          })
        : t("governance.calls.unknownNoData", { target: shortAddress(call.target) }),
      critical: true,
      unknown: true
    };
  }
  const arg = (index: number) => fn.args[index]?.value;
  const poolOf = (poolId: string | number) => {
    const pool = release.pools.find((item) => item.poolId === Number(poolId));
    const asset = pool
      ? release.assets.find((item) => item.address.toLowerCase() === pool.asset.toLowerCase())
      : undefined;
    const symbol = pool?.symbol ?? asset?.symbol;
    return {
      label: symbol ? `#${poolId} (${symbol})` : `#${poolId}`,
      symbol: symbol ?? "",
      decimals: pool?.decimals ?? asset?.decimals
    };
  };
  const contractPoolId = call.contract.poolId;
  const contractPool = contractPoolId == null ? undefined : poolOf(contractPoolId);
  const contract =
    call.contract.name === "Bank" && contractPool
      ? t("governance.contracts.bank", { pool: contractPool.label })
      : call.contract.name === "PoolRegistry"
        ? t("governance.contracts.poolRegistry")
        : call.contract.name === "GameHub"
          ? t("governance.contracts.gameHub")
          : call.contract.name === "ReferralRegistry"
            ? t("governance.contracts.referralRegistry")
            : t("governance.contracts.timelock");
  const poolAmount = (raw: GovernanceArgValue | undefined) =>
    contractPool?.decimals != null
      ? formatAmount(text(raw), contractPool.decimals, contractPool.symbol)
      : t("governance.calls.baseUnits", { amount: text(raw) });
  const gameOf = (gameId: GovernanceArgValue | undefined) =>
    release.gamesMeta?.find((game) => game.gameId.toLowerCase() === text(gameId).toLowerCase())
      ?.label ?? shortAddress(text(gameId));
  const critical = CRITICAL_FUNCTIONS.has(fn.name);
  const line = (key: string, values: Record<string, string> = {}): GovernanceLine => ({
    text: t(`governance.calls.${key}`, values),
    critical,
    unknown: false
  });

  switch (`${call.contract.name}.${fn.name}`) {
    case "PoolRegistry.registerPool": {
      const asset = release.assets.find(
        (item) => item.address.toLowerCase() === text(arg(1)).toLowerCase()
      );
      return line("registerPool", {
        pool: `#${text(arg(0))}`,
        asset: asset?.symbol ?? shortAddress(text(arg(1))),
        bank: shortAddress(text(arg(2)))
      });
    }
    case "PoolRegistry.setPoolActive":
      return line(arg(1) === true ? "activatePool" : "deactivatePool", {
        pool: poolOf(text(arg(0))).label
      });
    case "PoolRegistry.setHubRegistered":
      return line(arg(1) === true ? "registerHub" : "unregisterHub", {
        hub: shortAddress(text(arg(0)))
      });
    case "PoolRegistry.setHubAllowedForPool":
      return line(arg(2) === true ? "allowHub" : "disallowHub", {
        hub: shortAddress(text(arg(1))),
        pool: poolOf(text(arg(0))).label
      });
    case "GameHub.registerGame":
      return line("registerGame", {
        game: gameOf(arg(0)),
        module: shortAddress(text(arg(1))),
        rounds: text(arg(2))
      });
    case "GameHub.queueEdgeChange":
      return line("queueEdgeChange", { percent: formatBps(text(arg(0)), locale) });
    case "GameHub.cancelEdgeChange":
      return line("cancelEdgeChange");
    case "GameHub.setRefundTimeout":
      return line("setRefundTimeout", { duration: formatDuration(text(arg(0)), locale) });
    case "GameHub.createReferralConfig":
      return line("createReferralConfig", {
        player: formatBps(text(arg(0)), locale),
        level1: formatBps(text(arg(1)), locale),
        level2: formatBps(text(arg(2)), locale),
        holdback: formatBps(text(arg(3)), locale)
      });
    case "GameHub.setActiveReferralConfig":
      return line("setActiveReferralConfig", { id: text(arg(0)) });
    case "GameHub.disableGame":
      return line("disableGame", { game: gameOf(arg(0)) });
    case "GameHub.openVoidWindow":
      return line("openVoidWindow", { pool: poolOf(text(arg(0))).label });
    case "Bank.setRiskInPaused":
      return line(arg(0) === true ? "pausePool" : "unpausePool", {
        pool: contractPool?.label ?? ""
      });
    case "Bank.setMinBetAmount":
      return line("setMinBetAmount", {
        pool: contractPool?.label ?? "",
        amount: poolAmount(arg(0))
      });
    case "Bank.setRiskReserveBps":
      return line("setRiskReserveBps", {
        pool: contractPool?.label ?? "",
        percent: formatBps(text(arg(0)), locale)
      });
    case "Bank.setWithdrawalBufferBps":
      return line("setWithdrawalBufferBps", {
        pool: contractPool?.label ?? "",
        percent: formatBps(text(arg(0)), locale)
      });
    case "Bank.setHoldbackVestingSeconds":
      return line("setHoldbackVestingSeconds", {
        pool: contractPool?.label ?? "",
        duration: formatDuration(text(arg(0)), locale)
      });
    case "Bank.setMinPlayerTurnoverForUnlock":
      return line("setMinPlayerTurnoverForUnlock", {
        pool: contractPool?.label ?? "",
        amount: poolAmount(arg(0))
      });
    case "Bank.setGuardian":
      return line("setGuardian", {
        pool: contractPool?.label ?? "",
        account: shortAddress(text(arg(0)))
      });
    case "Bank.rescueToken": {
      const token = text(arg(0));
      const isPoolAsset =
        contractPool &&
        release.pools.some(
          (pool) =>
            pool.poolId === contractPoolId && pool.asset.toLowerCase() === token.toLowerCase()
        );
      return isPoolAsset
        ? line("rescuePoolAsset", {
            pool: contractPool.label,
            amount: poolAmount(arg(2)),
            account: shortAddress(text(arg(1)))
          })
        : line("rescueToken", {
            pool: contractPool?.label ?? "",
            amount: t("governance.calls.baseUnits", { amount: text(arg(2)) }),
            token: shortAddress(token),
            account: shortAddress(text(arg(1)))
          });
    }
    case "Bank.claimProtocolFees":
      return line("claimProtocolFees", {
        pool: contractPool?.label ?? "",
        amount: poolAmount(arg(0)),
        account: shortAddress(text(arg(1)))
      });
    case "Bank.setSettlementRouterOnce":
      return line("setSettlementRouterOnce", {
        pool: contractPool?.label ?? "",
        account: shortAddress(text(arg(0)))
      });
    case "Bank.setRandomnessConsumerOnce":
      return line("setRandomnessConsumerOnce", {
        pool: contractPool?.label ?? "",
        account: shortAddress(text(arg(0)))
      });
    case "ReferralRegistry.setBinderOnce":
      return line("setBinderOnce", { account: shortAddress(text(arg(0))) });
    case "GovernanceTimelock.updateDelay":
      return line("updateDelay", { duration: formatDuration(text(arg(0)), locale) });
    case "GovernanceTimelock.grantRole":
    case "GovernanceTimelock.revokeRole":
    case "GovernanceTimelock.renounceRole":
      return line(fn.name, {
        role: call.roleName ? t(`governance.roles.${call.roleName}`) : shortAddress(text(arg(0))),
        account: shortAddress(text(arg(1)))
      });
  }
  if (fn.name === "setSentinel") {
    return text(arg(0)).toLowerCase() === ZERO_ADDRESS
      ? line("removeSentinel", { contract })
      : line("setSentinel", { contract, account: shortAddress(text(arg(0))) });
  }
  if (fn.name === "transferGovernance")
    return line("transferGovernance", { contract, account: shortAddress(text(arg(0))) });
  if (fn.name === "acceptGovernance") return line("acceptGovernance", { contract });
  return line("otherFunction", { contract, signature: fn.signature });
}

import { loadEmbeddedRelease } from "@ssot/ssot/release";

import { queryRecentBets } from "./betting/recent-bets";
import { parseRequestChainId } from "./chain";
import { readKeeperHealthSnapshot } from "./ops/keeper-health";

type HealthCheckState = "ok" | "degraded";

export type HealthzSnapshot = {
  schemaVersion: 1;
  status: HealthCheckState;
  chainId: number;
  generatedAt: string;
  checks: {
    release: {
      status: HealthCheckState;
      name?: string;
      warnings: string[];
      message?: string;
    };
    keeper: {
      status: HealthCheckState;
      role: string;
      keeperStatus: string;
      updatedAt: string;
      ageMs: number | null;
      queueDepth: number;
      message?: string;
    };
    betIndex: {
      status: HealthCheckState;
      source: string;
      rows: number;
      durableRequired: boolean;
      durableConfigured: boolean;
      message?: string;
    };
  };
};

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isFalsey(value: string | undefined) {
  return /^(0|false|no|off)$/i.test(value?.trim() ?? "");
}

function isTruthy(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? "");
}

function keeperMaxAgeMs() {
  const parsed = Number(process.env.HEALTHZ_KEEPER_MAX_AGE_MS ?? "300000");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300000;
}

function ageMs(isoDate: string) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Date.now() - parsed);
}

function durableBetIndexConfigured() {
  return (
    Boolean(cleanEnv(process.env.BET_INDEX_DATABASE_URL)) &&
    !isFalsey(process.env.BET_INDEX_READ_ENABLED)
  );
}

function durableBetIndexRequired(chainId: number) {
  return chainId === 8453 || isTruthy(process.env.HEALTHZ_REQUIRE_DURABLE_BET_INDEX);
}

function summarizeStatus(states: HealthCheckState[]): HealthCheckState {
  return states.every((state) => state === "ok") ? "ok" : "degraded";
}

export async function getHealthzSnapshot({
  chainId = parseRequestChainId(process.env.NEXT_PUBLIC_CHAIN_ID)
}: {
  chainId?: number;
} = {}): Promise<HealthzSnapshot> {
  const releaseResult = loadEmbeddedRelease(chainId);
  const releaseCheck: HealthzSnapshot["checks"]["release"] = releaseResult.ok
    ? {
        status: releaseResult.warnings.length > 0 ? "degraded" : "ok",
        name: releaseResult.release.name,
        warnings: releaseResult.warnings,
        message: releaseResult.warnings.length > 0 ? releaseResult.warnings.join("; ") : undefined
      }
    : {
        status: "degraded",
        warnings: [],
        message: releaseResult.error
      };

  const keeper = await readKeeperHealthSnapshot({ chainId });
  const keeperAgeMs = ageMs(keeper.updatedAt);
  const stale = keeperAgeMs == null || keeperAgeMs > keeperMaxAgeMs();
  const keeperOk =
    keeper.chainId === chainId &&
    keeper.status === "running" &&
    !stale &&
    keeper.keeper !== "0x0000000000000000000000000000000000000000";
  const keeperCheck: HealthzSnapshot["checks"]["keeper"] = {
    status: keeperOk ? "ok" : "degraded",
    role: keeper.role,
    keeperStatus: keeper.status,
    updatedAt: keeper.updatedAt,
    ageMs: keeperAgeMs,
    queueDepth: Number(keeper.queueDepth ?? 0),
    message: keeperOk
      ? undefined
      : [
          keeper.chainId === chainId
            ? undefined
            : `keeper chainId ${keeper.chainId} does not match ${chainId}`,
          keeper.status === "running" ? undefined : `keeper status is ${keeper.status}`,
          stale ? "keeper snapshot is missing or stale" : undefined,
          keeper.keeper === "0x0000000000000000000000000000000000000000"
            ? "keeper address is zero"
            : undefined
        ]
          .filter(Boolean)
          .join("; ")
  };

  const durableConfigured = durableBetIndexConfigured();
  const durableRequired = durableBetIndexRequired(chainId);
  let betIndexCheck: HealthzSnapshot["checks"]["betIndex"];
  try {
    const recent = await queryRecentBets({ chainId, limit: 1 });
    const source = recent.source;
    const durableOk = !durableRequired || (durableConfigured && source === "postgres");
    betIndexCheck = {
      status: durableOk ? "ok" : "degraded",
      source,
      rows: recent.rows.length,
      durableRequired,
      durableConfigured,
      message: durableOk
        ? undefined
        : "durable Postgres bet index is required for this chain but is not serving reads"
    };
  } catch (error) {
    betIndexCheck = {
      status: "degraded",
      source: "unavailable",
      rows: 0,
      durableRequired,
      durableConfigured,
      message: error instanceof Error ? error.message : "Failed to query bet index"
    };
  }

  const checks = {
    release: releaseCheck,
    keeper: keeperCheck,
    betIndex: betIndexCheck
  };
  return {
    schemaVersion: 1,
    status: summarizeStatus(Object.values(checks).map((check) => check.status)),
    chainId,
    generatedAt: new Date().toISOString(),
    checks
  };
}

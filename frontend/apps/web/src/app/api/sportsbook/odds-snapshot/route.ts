import { NextResponse } from "next/server";
import {
  createSignedSportsOddsSnapshot,
  SignedSportsOddsSnapshotError,
  type SignedSportsOddsSnapshotRequest
} from "@ssot/ssot/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}

function env(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function requiredEnv(name: string) {
  const value = env(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function envAny(names: string[]) {
  for (const name of names) {
    const value = env(name);
    if (value) return value;
  }
  return undefined;
}

function requiredEnvAny(names: string[]) {
  const value = envAny(names);
  if (!value) throw new Error(`Missing one of ${names.join(", ")}.`);
  return value;
}

function sportsbookEnabled() {
  return env("NEXT_PUBLIC_SPORTSBOOK_ENABLED")?.toLowerCase() === "true";
}

export async function POST(request: Request) {
  try {
    if (!sportsbookEnabled()) {
      return jsonError("NEXT_PUBLIC_SPORTSBOOK_ENABLED is not true.", 403, "SPORTSBOOK_DISABLED");
    }

    const body = (await request.json()) as SignedSportsOddsSnapshotRequest;
    const snapshot = await createSignedSportsOddsSnapshot({
      request: body,
      oddsApiKey: requiredEnv("THE_ODDS_API_KEY"),
      oddsSignerPrivateKey: requiredEnvAny([
        "SPORTS_ODDS_SIGNER_PRIVATE_KEY",
        "FOOTBALL_ODDS_SIGNER_PRIVATE_KEY",
        "CANARY_ODDS_SIGNER_PRIVATE_KEY"
      ]),
      rpcUrl: env("RPC_URL"),
      expectedOddsSigner: env("SPORTS_ODDS_SIGNER"),
      defaultSportKey: env("SPORTS_PROVIDER_SPORT_KEY"),
      defaultProviderEventId: env("SPORTS_PROVIDER_EVENT_ID"),
      defaultBookmakerKey: env("SPORTS_BOOKMAKER_KEY"),
      regions: env("THE_ODDS_API_REGIONS"),
      ttlSeconds: Number(env("SPORTS_ODDS_TTL_SECONDS") ?? "120")
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof SignedSportsOddsSnapshotError) {
      return jsonError(error.message, error.status, error.code);
    }
    const message =
      error instanceof Error ? error.message : "Failed to create signed odds snapshot.";
    return jsonError(message, 500, "ODDS_SNAPSHOT_FAILED");
  }
}

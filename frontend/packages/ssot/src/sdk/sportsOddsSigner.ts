import { randomInt } from "crypto";
import { createPublicClient, getAddress, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, arbitrumSepolia, base, baseSepolia } from "viem/chains";
import { loadEmbeddedRelease } from "../release";
import { createSSOTSDK } from "./create";
import type { SportsOddsSnapshotInput } from "./types";

const WAD = 10n ** 18n;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const THE_ODDS_API_ENDPOINT = "https://api.the-odds-api.com/v4/sports";
const CHAINS = [baseSepolia, base, arbitrumSepolia, arbitrum] as const;

export class SignedSportsOddsSnapshotError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "SignedSportsOddsSnapshotError";
    this.status = status;
    this.code = code;
  }
}

export interface SignedSportsOddsSnapshotRequest {
  chainId?: number;
  marketId?: string;
  outcomeId?: number;
  player?: string;
  stake?: string;
  providerEventId?: string;
  bookmakerKey?: string;
  sportKey?: string;
}

export interface CreateSignedSportsOddsSnapshotOptions {
  request: SignedSportsOddsSnapshotRequest;
  oddsApiKey: string;
  oddsSignerPrivateKey: string;
  rpcUrl?: string;
  expectedOddsSigner?: string;
  defaultSportKey?: string;
  defaultProviderEventId?: string;
  defaultBookmakerKey?: string;
  regions?: string;
  ttlSeconds?: number;
  fetchFn?: typeof fetch;
}

export interface SignedSportsOddsSnapshotResponse {
  schemaVersion: "sportsbook.signed-odds-ticket.v1";
  provider: {
    name: "the-odds-api";
    sportKey: string;
    providerEventId: string;
    bookmakerKey?: string;
    bookmakerTitle?: string;
    marketLastUpdate?: string;
  };
  market: {
    marketId: string;
    eventId: string;
    poolId: number;
    marketVersion: string;
  };
  outcome: {
    outcomeId: number;
    side: "home" | "draw" | "away";
    name: string;
    decimalPrice: string;
    oddsWad: string;
  };
  stake: string;
  payout: string;
  odds: {
    marketId: string;
    outcomeId: number;
    marketVersion: string;
    oddsWad: string;
    maxStake: string;
    maxPayout: string;
    expiresAt: string;
    nonce: string;
    riskHash: Hex;
  };
  oddsTicketHash: Hex;
  signer: Address;
  signature: Hex;
}

type ProviderEvent = {
  id?: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: Array<{
    key?: string;
    title?: string;
    last_update?: string;
    markets?: Array<{
      key?: string;
      last_update?: string;
      outcomes?: Array<{ name?: string; price?: number | string }>;
    }>;
  }>;
};

function fail(message: string, status = 400, code = "BAD_REQUEST"): never {
  throw new SignedSportsOddsSnapshotError(message, status, code);
}

function parseDecimalOddsToWad(value: number | string) {
  const raw = String(value).trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(raw)) {
    fail(`Invalid decimal odds: ${raw}`, 502, "PROVIDER_BAD_ODDS");
  }
  const [wholeRaw, fraction = ""] = raw.split(".");
  const whole = wholeRaw || "0";
  const scaled = BigInt(whole) * WAD + BigInt((fraction + "0".repeat(18)).slice(0, 18));
  if (scaled <= WAD) {
    fail(`Decimal odds must be greater than 1.0: ${raw}`, 502, "PROVIDER_BAD_ODDS");
  }
  return scaled;
}

function payoutForOdds(stake: bigint, oddsWad: bigint) {
  return (stake * oddsWad) / WAD;
}

function parsePositiveBigInt(value: string | undefined, label: string) {
  if (!value || !/^[0-9]+$/.test(value)) fail(`${label} must be a positive integer.`);
  const parsed = BigInt(value);
  if (parsed <= 0n) fail(`${label} must be greater than zero.`);
  return parsed;
}

function parsePrivateKey(raw: string): Hex {
  const value = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    fail(
      "SPORTS_ODDS_SIGNER_PRIVATE_KEY must be a 32-byte private key.",
      500,
      "ODDS_SIGNER_CONFIG_INVALID"
    );
  }
  return value as Hex;
}

function chainForId(chainId: number) {
  return CHAINS.find((chain) => chain.id === chainId) ?? baseSepolia;
}

function findProviderMarket(
  events: ProviderEvent[],
  providerEventId: string | undefined,
  bookmakerKey: string | undefined
) {
  const candidates = providerEventId
    ? events.filter((event) => String(event.id ?? "") === providerEventId)
    : events;
  for (const event of candidates) {
    const bookmakers = Array.isArray(event.bookmakers) ? event.bookmakers : [];
    for (const bookmaker of bookmakers) {
      if (bookmakerKey && bookmaker.key !== bookmakerKey) continue;
      const markets = Array.isArray(bookmaker.markets) ? bookmaker.markets : [];
      const market = markets.find((item) => item.key === "h2h");
      if (market) return { event, bookmaker, market };
    }
  }
  fail(
    providerEventId
      ? `Provider event ${providerEventId} has no h2h odds.`
      : "No provider h2h odds found.",
    502,
    "PROVIDER_H2H_MISSING"
  );
}

function outcomeFromEvent(
  event: ProviderEvent,
  market: NonNullable<ReturnType<typeof findProviderMarket>>["market"],
  outcomeId: number
) {
  const home = String(event.home_team ?? "");
  const away = String(event.away_team ?? "");
  if (!home || !away) {
    fail("Provider event is missing home or away team.", 502, "PROVIDER_EVENT_INCOMPLETE");
  }
  const name = outcomeId === 0 ? home : outcomeId === 1 ? "Draw" : outcomeId === 2 ? away : "";
  if (!name) fail("Football 1X2 supports outcome ids 0, 1, and 2.", 400, "BAD_OUTCOME");
  const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
  const row = outcomes.find((item) => item.name === name);
  if (!row?.price) fail(`Provider odds missing outcome: ${name}.`, 502, "PROVIDER_OUTCOME_MISSING");
  return {
    name,
    side: outcomeId === 0 ? "home" : outcomeId === 1 ? "draw" : "away",
    oddsWad: parseDecimalOddsToWad(row.price),
    decimalPrice: String(row.price)
  } as const;
}

async function fetchProviderOdds(options: CreateSignedSportsOddsSnapshotOptions) {
  const req = options.request;
  const sportKey = req.sportKey || options.defaultSportKey || "soccer_fifa_world_cup";
  const providerEventId = req.providerEventId || options.defaultProviderEventId;
  const bookmakerKey = req.bookmakerKey || options.defaultBookmakerKey;
  const url = new URL(`${THE_ODDS_API_ENDPOINT}/${encodeURIComponent(sportKey)}/odds/`);
  url.searchParams.set("apiKey", options.oddsApiKey);
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");
  if (providerEventId) url.searchParams.set("eventIds", providerEventId);
  if (bookmakerKey) {
    url.searchParams.set("bookmakers", bookmakerKey);
  } else {
    url.searchParams.set("regions", options.regions || "us,uk,eu,au");
  }

  const fetcher = options.fetchFn ?? fetch;
  const response = await fetcher(url, {
    headers: { "User-Agent": "arbigamefi-web-odds-snapshot/1.0" },
    cache: "no-store"
  });
  if (!response.ok) {
    fail(
      `The Odds API request failed with status ${response.status}.`,
      502,
      "PROVIDER_REQUEST_FAILED"
    );
  }
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    fail("The Odds API odds response must be an array.", 502, "PROVIDER_BAD_RESPONSE");
  }
  const selected = findProviderMarket(payload as ProviderEvent[], providerEventId, bookmakerKey);
  return { ...selected, providerEventId: String(selected.event.id ?? ""), sportKey };
}

export async function createSignedSportsOddsSnapshot(
  options: CreateSignedSportsOddsSnapshotOptions
): Promise<SignedSportsOddsSnapshotResponse> {
  if (!options.oddsApiKey.trim())
    fail("Missing THE_ODDS_API_KEY.", 500, "ODDS_PROVIDER_CONFIG_MISSING");
  if (!options.oddsSignerPrivateKey.trim())
    fail("Missing SPORTS_ODDS_SIGNER_PRIVATE_KEY.", 500, "ODDS_SIGNER_CONFIG_MISSING");

  const body = options.request;
  const chainId = Number(body.chainId ?? 84532);
  const releaseResult = loadEmbeddedRelease(chainId);
  if (!releaseResult.ok) fail(releaseResult.error, 400, "RELEASE_UNAVAILABLE");
  const release = releaseResult.release;
  if (!release.sports.enabled || release.contracts.sportsHub === ZERO_ADDRESS) {
    fail(
      "The active release does not expose enabled SportsHub metadata.",
      403,
      "SPORTS_RELEASE_DISABLED"
    );
  }

  const marketId = parsePositiveBigInt(body.marketId, "marketId");
  const stake = parsePositiveBigInt(body.stake, "stake");
  const outcomeId = Number(body.outcomeId);
  if (!Number.isSafeInteger(outcomeId) || outcomeId < 0) {
    fail("outcomeId must be a non-negative integer.", 400, "BAD_OUTCOME");
  }
  if (!body.player) fail("player is required.", 400, "PLAYER_REQUIRED");
  const player = getAddress(body.player as Address);

  const publicClient = createPublicClient({
    chain: chainForId(chainId),
    transport: http(options.rpcUrl)
  });
  const sdk = createSSOTSDK({ release, publicClient: publicClient as any });
  const market = await sdk.sportsHub.getMarket(marketId);
  if (market.state !== "open") fail("Market is not open.", 409, "MARKET_NOT_OPEN");
  if (market.poolId <= 0) fail("Market has no valid pool.", 409, "BAD_MARKET_POOL");
  if (market.outcomeCount !== 3 || outcomeId >= market.outcomeCount) {
    fail("Football 1X2 requires a 3-outcome market and valid outcome id.", 400, "BAD_OUTCOME");
  }

  const pool = release.pools.find((item) => item.poolId === market.poolId);
  const risk = pool?.sportsRisk;
  if (!risk) fail("Sports pool risk metadata is unavailable.", 409, "RISK_METADATA_MISSING");

  const provider = await fetchProviderOdds(options);
  const outcome = outcomeFromEvent(provider.event, provider.market, outcomeId);
  const maxStake = BigInt(risk.maxStake);
  const maxPayout = BigInt(risk.maxPayout);
  const payout = payoutForOdds(stake, outcome.oddsWad);
  if (stake > maxStake) fail("Stake exceeds the sports risk maxStake.", 409, "STAKE_TOO_LARGE");
  if (payout > maxPayout) {
    fail("Provider odds imply a payout above maxPayout.", 409, "PAYOUT_TOO_LARGE");
  }

  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? 120;
  const expiresAt = BigInt(Math.min(now + Math.max(ttlSeconds, 1), market.lockTime - 1));
  if (expiresAt <= BigInt(now))
    fail("Market lock time is too close for a fresh odds snapshot.", 409, "MARKET_LOCK_TOO_CLOSE");

  const odds: SportsOddsSnapshotInput = {
    marketId,
    outcomeId,
    marketVersion: market.version,
    oddsWad: outcome.oddsWad,
    maxStake,
    maxPayout,
    expiresAt,
    nonce: BigInt(Date.now()) * 1000n + BigInt(randomInt(0, 1000)),
    riskHash: risk.riskHash as Hex
  };
  const oddsTicketHash = await sdk.sportsHub.hashOddsTicket(odds, player, stake);
  const signer = privateKeyToAccount(parsePrivateKey(options.oddsSignerPrivateKey));
  if (
    options.expectedOddsSigner &&
    getAddress(options.expectedOddsSigner as Address) !== signer.address
  ) {
    fail(
      "Configured odds signer private key does not match SPORTS_ODDS_SIGNER.",
      500,
      "ODDS_SIGNER_MISMATCH"
    );
  }
  const signature = await signer.sign({ hash: oddsTicketHash });

  return {
    schemaVersion: "sportsbook.signed-odds-ticket.v1",
    provider: {
      name: "the-odds-api",
      sportKey: provider.sportKey,
      providerEventId: provider.providerEventId,
      bookmakerKey: provider.bookmaker.key,
      bookmakerTitle: provider.bookmaker.title,
      marketLastUpdate: provider.market.last_update
    },
    market: {
      marketId: market.marketId.toString(),
      eventId: market.eventId.toString(),
      poolId: market.poolId,
      marketVersion: market.version.toString()
    },
    outcome: {
      outcomeId,
      side: outcome.side,
      name: outcome.name,
      decimalPrice: outcome.decimalPrice,
      oddsWad: odds.oddsWad.toString()
    },
    stake: stake.toString(),
    payout: payout.toString(),
    odds: {
      marketId: odds.marketId.toString(),
      outcomeId: odds.outcomeId,
      marketVersion: odds.marketVersion.toString(),
      oddsWad: odds.oddsWad.toString(),
      maxStake: odds.maxStake.toString(),
      maxPayout: odds.maxPayout.toString(),
      expiresAt: odds.expiresAt.toString(),
      nonce: odds.nonce.toString(),
      riskHash: odds.riskHash
    },
    oddsTicketHash,
    signer: signer.address,
    signature
  };
}

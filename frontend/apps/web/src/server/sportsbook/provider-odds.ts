import type {
  SportsbookProviderOdds,
  SportsbookProviderOutcome,
  SportsbookProviderOutcomeSide
} from "../../features/sportsbook/provider-odds";

const THE_ODDS_API_ENDPOINT = "https://api.the-odds-api.com/v4/sports";

type ProviderEvent = {
  id?: string;
  home_team?: string;
  away_team?: string;
  commence_time?: string;
  bookmakers?: Array<{
    key?: string;
    title?: string;
    markets?: Array<{
      key?: string;
      last_update?: string;
      outcomes?: Array<{ name?: string; price?: number | string }>;
    }>;
  }>;
};

export class SportsbookProviderOddsError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "SportsbookProviderOddsError";
    this.status = status;
    this.code = code;
  }
}

function fail(message: string, status = 400, code = "BAD_REQUEST"): never {
  throw new SportsbookProviderOddsError(message, status, code);
}

function envForMarket(name: string, marketId: string | undefined) {
  return (marketId ? process.env[`${name}_${marketId}`] : undefined) ?? process.env[name];
}

function decimalPrice(value: number | string | undefined) {
  if (value === undefined) return undefined;
  const raw = String(value).trim();
  return /^[0-9]+(\.[0-9]+)?$/.test(raw) ? raw : undefined;
}

function findProviderSelection(
  events: ProviderEvent[],
  providerEventId: string | undefined,
  bookmakerKey: string | undefined
) {
  const candidates = providerEventId
    ? events.filter((event) => String(event.id ?? "") === providerEventId)
    : events;

  for (const event of candidates) {
    for (const bookmaker of event.bookmakers ?? []) {
      if (bookmakerKey && bookmaker.key !== bookmakerKey) continue;
      const market = bookmaker.markets?.find((item) => item.key === "h2h");
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

function outcome(
  outcomeId: number,
  side: SportsbookProviderOutcomeSide,
  name: string,
  outcomes: Array<{ name?: string; price?: number | string }> | undefined
): SportsbookProviderOutcome {
  const price = decimalPrice(outcomes?.find((item) => item.name === name)?.price);
  if (!price) fail(`Provider odds missing outcome: ${name}.`, 502, "PROVIDER_OUTCOME_MISSING");
  return { outcomeId, side, name, decimalPrice: price };
}

export async function getSportsbookProviderOdds({
  searchParams,
  fetchFn = fetch
}: {
  searchParams: URLSearchParams;
  fetchFn?: typeof fetch;
}): Promise<SportsbookProviderOdds> {
  if (process.env.NEXT_PUBLIC_SPORTSBOOK_ENABLED !== "true") {
    fail("NEXT_PUBLIC_SPORTSBOOK_ENABLED is not true.", 403, "SPORTSBOOK_DISABLED");
  }

  const oddsApiKey = process.env.THE_ODDS_API_KEY?.trim();
  if (!oddsApiKey) fail("Missing THE_ODDS_API_KEY.", 500, "ODDS_PROVIDER_CONFIG_MISSING");

  const marketId = searchParams.get("marketId")?.trim() || undefined;
  const sportKey =
    searchParams.get("sportKey")?.trim() ||
    envForMarket("SPORTS_PROVIDER_SPORT_KEY", marketId) ||
    "soccer_fifa_world_cup";
  const providerEventId =
    searchParams.get("providerEventId")?.trim() ||
    envForMarket("SPORTS_PROVIDER_EVENT_ID", marketId);
  const bookmakerKey =
    searchParams.get("bookmakerKey")?.trim() || envForMarket("SPORTS_BOOKMAKER_KEY", marketId);
  const regions = searchParams.get("regions")?.trim() || process.env.THE_ODDS_API_REGIONS || "us";

  const url = new URL(`${THE_ODDS_API_ENDPOINT}/${encodeURIComponent(sportKey)}/odds/`);
  url.searchParams.set("apiKey", oddsApiKey);
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");
  if (providerEventId) url.searchParams.set("eventIds", providerEventId);
  if (bookmakerKey) {
    url.searchParams.set("bookmakers", bookmakerKey);
  } else {
    url.searchParams.set("regions", regions);
  }

  const response = await fetchFn(url, {
    headers: { "User-Agent": "arbigamefi-web-provider-odds/1.0" },
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

  const { event, bookmaker, market } = findProviderSelection(
    payload as ProviderEvent[],
    providerEventId,
    bookmakerKey
  );
  const homeTeam = String(event.home_team ?? "");
  const awayTeam = String(event.away_team ?? "");
  if (!homeTeam || !awayTeam) {
    fail("Provider event is missing home or away team.", 502, "PROVIDER_EVENT_INCOMPLETE");
  }

  const marketOutcomes = market.outcomes ?? [];
  return {
    schemaVersion: "sportsbook.provider-odds.v1",
    provider: {
      name: "the-odds-api",
      sportKey,
      providerEventId: String(event.id ?? ""),
      bookmakerKey: bookmaker.key,
      bookmakerTitle: bookmaker.title,
      marketLastUpdate: market.last_update
    },
    event: {
      homeTeam,
      awayTeam,
      commenceTime: event.commence_time
    },
    outcomes: [
      outcome(0, "home", homeTeam, marketOutcomes),
      outcome(1, "draw", "Draw", marketOutcomes),
      outcome(2, "away", awayTeam, marketOutcomes)
    ]
  };
}

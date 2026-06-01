import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitBucketsForTests } from "../../../../server/http/rate-limit";

const originalEnv = process.env;

async function json(response: Response) {
  return (await response.json()) as any;
}

function request(query = "", init?: RequestInit) {
  return new Request(`http://localhost/api/sportsbook/provider-odds${query}`, init);
}

describe("GET /api/sportsbook/provider-odds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimitBucketsForTests();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SPORTSBOOK_ENABLED: "true",
      THE_ODDS_API_KEY: "test-odds-key",
      SPORTS_PROVIDER_SPORT_KEY: "soccer_usa_mls",
      SPORTS_PROVIDER_EVENT_ID: "event-1",
      SPORTS_BOOKMAKER_KEY: "draftkings",
      THE_ODDS_API_REGIONS: "us"
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("fails closed when sportsbook is disabled", async () => {
    process.env.NEXT_PUBLIC_SPORTSBOOK_ENABLED = "false";
    const { GET } = await import("./route");

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(await json(response)).toEqual({
      error: {
        code: "SPORTSBOOK_DISABLED",
        message: "NEXT_PUBLIC_SPORTSBOOK_ENABLED is not true."
      }
    });
  });

  it("returns provider teams and 1X2 prices", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "event-1",
          home_team: "Seattle Sounders",
          away_team: "Inter Miami",
          commence_time: "2026-06-11T19:00:00Z",
          bookmakers: [
            {
              key: "draftkings",
              title: "DraftKings",
              markets: [
                {
                  key: "h2h",
                  last_update: "2026-06-11T18:45:00Z",
                  outcomes: [
                    { name: "Seattle Sounders", price: 2.1 },
                    { name: "Draw", price: 3.4 },
                    { name: "Inter Miami", price: 2.9 }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");

    const response = await GET(request("?marketId=7"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      schemaVersion: "sportsbook.provider-odds.v1",
      provider: {
        providerEventId: "event-1",
        bookmakerKey: "draftkings",
        bookmakerTitle: "DraftKings"
      },
      event: {
        homeTeam: "Seattle Sounders",
        awayTeam: "Inter Miami",
        commenceTime: "2026-06-11T19:00:00Z"
      },
      outcomes: [
        { outcomeId: 0, side: "home", name: "Seattle Sounders", decimalPrice: "2.1" },
        { outcomeId: 1, side: "draw", name: "Draw", decimalPrice: "3.4" },
        { outcomeId: 2, side: "away", name: "Inter Miami", decimalPrice: "2.9" }
      ]
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining("/soccer_usa_mls/odds/")
      }),
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("supports market-specific provider env overrides", async () => {
    process.env.SPORTS_PROVIDER_EVENT_ID_7 = "event-7";
    process.env.SPORTS_BOOKMAKER_KEY_7 = "fanduel";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "event-7",
          home_team: "Home",
          away_team: "Away",
          bookmakers: [
            {
              key: "fanduel",
              markets: [
                {
                  key: "h2h",
                  outcomes: [
                    { name: "Home", price: 2 },
                    { name: "Draw", price: 3 },
                    { name: "Away", price: 4 }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");

    const response = await GET(request("?marketId=7"));

    expect(response.status).toBe(200);
    const calledUrl = fetchMock.mock.calls[0]?.[0] as URL;
    expect(calledUrl.searchParams.get("eventIds")).toBe("event-7");
    expect(calledUrl.searchParams.get("bookmakers")).toBe("fanduel");
  });

  it("returns an unavailable envelope instead of a 5xx when the provider rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "unauthorized" })
      })
    );
    const { GET } = await import("./route");

    const response = await GET(request("?marketId=7"));

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({
      schemaVersion: "sportsbook.provider-odds-unavailable.v1",
      unavailable: {
        code: "PROVIDER_REQUEST_FAILED",
        message: "The Odds API request failed with status 401."
      }
    });
  });

  it("returns an unavailable envelope instead of a 5xx when the provider key is missing", async () => {
    delete process.env.THE_ODDS_API_KEY;
    const { GET } = await import("./route");

    const response = await GET(request("?marketId=7"));

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({
      schemaVersion: "sportsbook.provider-odds-unavailable.v1",
      unavailable: {
        code: "ODDS_PROVIDER_CONFIG_MISSING",
        message: "Missing THE_ODDS_API_KEY."
      }
    });
  });

  it("rate limits provider odds reads per client", async () => {
    process.env.SPORTSBOOK_PROVIDER_ODDS_RATE_LIMIT_PER_MINUTE = "1";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "event-1",
          home_team: "Seattle Sounders",
          away_team: "Inter Miami",
          bookmakers: [
            {
              key: "draftkings",
              markets: [
                {
                  key: "h2h",
                  outcomes: [
                    { name: "Seattle Sounders", price: 2.1 },
                    { name: "Draw", price: 3.4 },
                    { name: "Inter Miami", price: 2.9 }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");

    const first = await GET(
      request("?marketId=7", { headers: { "x-forwarded-for": "203.0.113.10" } })
    );
    const second = await GET(
      request("?marketId=7", { headers: { "x-forwarded-for": "203.0.113.10" } })
    );

    expect(first.status).toBe(200);
    expect(first.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
    expect(await json(second)).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many sportsbook provider odds requests. Please retry shortly."
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

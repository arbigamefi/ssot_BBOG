import { describe, expect, it } from "vitest";

import { isSportsbookProviderOdds, isSportsbookProviderOddsUnavailable } from "./provider-odds";

describe("isSportsbookProviderOdds", () => {
  it("accepts provider odds payloads and rejects signed snapshot payloads", () => {
    expect(
      isSportsbookProviderOdds({
        schemaVersion: "sportsbook.provider-odds.v1",
        provider: {
          name: "the-odds-api",
          sportKey: "soccer_usa_mls",
          providerEventId: "event-1",
          bookmakerKey: "draftkings"
        },
        event: {
          homeTeam: "Home FC",
          awayTeam: "Away FC"
        },
        outcomes: [
          { outcomeId: 0, side: "home", name: "Home FC", decimalPrice: "2.1" },
          { outcomeId: 1, side: "draw", name: "Draw", decimalPrice: "3.4" },
          { outcomeId: 2, side: "away", name: "Away FC", decimalPrice: "2.9" }
        ]
      })
    ).toBe(true);

    expect(
      isSportsbookProviderOdds({
        provider: { providerEventId: "event-1", sportKey: "soccer_usa_mls" },
        odds: { oddsWad: "2100000000000000000" },
        signature: `0x${"11".repeat(65)}`
      })
    ).toBe(false);
  });
});

describe("isSportsbookProviderOddsUnavailable", () => {
  it("accepts the provider-unavailable envelope", () => {
    expect(
      isSportsbookProviderOddsUnavailable({
        schemaVersion: "sportsbook.provider-odds-unavailable.v1",
        unavailable: {
          code: "PROVIDER_REQUEST_FAILED",
          message: "Provider request failed."
        }
      })
    ).toBe(true);
  });

  it("rejects malformed unavailable envelopes", () => {
    expect(
      isSportsbookProviderOddsUnavailable({
        schemaVersion: "sportsbook.provider-odds-unavailable.v1",
        unavailable: { code: "PROVIDER_REQUEST_FAILED" }
      })
    ).toBe(false);
  });
});

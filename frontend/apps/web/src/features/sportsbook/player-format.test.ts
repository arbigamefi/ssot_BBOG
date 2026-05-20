import { describe, expect, it } from "vitest";

import { bucketMarket, describeMarketWallClock } from "./player-format";

const NOW = Date.UTC(2026, 4, 19, 12, 0, 0);

function market(startsAtSeconds: number, state: "open" | "resolved" | "voided" = "open") {
  return { startsAt: startsAtSeconds, state };
}

describe("sportsbook player-format", () => {
  it("buckets markets that start within 15 minutes as live", () => {
    const clock = describeMarketWallClock(market(Math.floor((NOW + 10 * 60_000) / 1000)), NOW);
    expect(clock.kind).toBe("live");
    expect(bucketMarket(clock, NOW)).toBe("live");
  });

  it("buckets same-day non-live markets as today", () => {
    const clock = describeMarketWallClock(market(Math.floor((NOW + 90 * 60_000) / 1000)), NOW);
    expect(clock.kind).toBe("soon");
    expect(bucketMarket(clock, NOW)).toBe("today");
  });

  it("buckets future markets after today as upcoming", () => {
    const clock = describeMarketWallClock(market(Math.floor((NOW + 36 * 60 * 60_000) / 1000)), NOW);
    expect(clock.kind).toBe("scheduled");
    expect(bucketMarket(clock, NOW)).toBe("upcoming");
  });

  it("treats resolved and voided markets as past regardless of kickoff time", () => {
    const futureResolved = describeMarketWallClock(
      market(Math.floor((NOW + 60 * 60_000) / 1000), "resolved"),
      NOW
    );
    const futureVoided = describeMarketWallClock(
      market(Math.floor((NOW + 60 * 60_000) / 1000), "voided"),
      NOW
    );
    expect(bucketMarket(futureResolved, NOW)).toBe("past");
    expect(bucketMarket(futureVoided, NOW)).toBe("past");
  });

  it("keeps unknown kickoff data out of the past bucket", () => {
    const clock = describeMarketWallClock({ startsAt: 0, state: "open" }, NOW);
    expect(clock.kind).toBe("unknown");
    expect(bucketMarket(clock, NOW)).toBe("upcoming");
  });
});

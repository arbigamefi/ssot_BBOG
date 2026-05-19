import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import type { DomainSportsMarket } from "@ssot/ssot";

import { EventBoard, type EventBoardEntry } from "./EventBoard";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (scope?: string) => (key: string, values?: Record<string, string | number>) => {
    const full = scope ? `${scope}.${key}` : key;
    const messages: Record<string, string> = {
      "sportsbook.player.board.bucket.live": "Live now",
      "sportsbook.player.board.bucket.today": "Today",
      "sportsbook.player.board.bucket.upcoming": "Upcoming",
      "sportsbook.player.board.bucket.past": "Recently settled",
      "sportsbook.player.board.count": "{count} markets",
      "sportsbook.player.event.fallbackTitle": "Market {tag}",
      "sportsbook.player.event.kickoffAt": "Kickoff {time}",
      "sportsbook.player.event.outcomesPending": "{count} outcomes pending",
      "sportsbook.player.marketState.live": "Live",
      "sportsbook.player.marketState.open": "Open",
      "sportsbook.player.marketState.resolved": "Settled",
      "sportsbook.player.marketState.voided": "Voided"
    };
    let message = messages[full] ?? full;
    for (const [name, value] of Object.entries(values ?? {})) {
      message = message.replace(`{${name}}`, String(value));
    }
    return message;
  }
}));

function market(
  marketId: bigint,
  startsAt: number,
  state: DomainSportsMarket["state"] = "open"
): DomainSportsMarket {
  return {
    eventId: marketId,
    lockTime: startsAt,
    marketId,
    marketKey: `0x${marketId.toString(16).padStart(64, "0")}` as `0x${string}`,
    outcomeCount: 3,
    poolId: 1,
    resultFinalitySeconds: 3600,
    rulebookHash: "0x1" as `0x${string}`,
    startsAt,
    state,
    version: 1n
  };
}

describe("EventBoard", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("filters the board to a single selected bucket", () => {
    const now = Date.UTC(2026, 4, 19, 12, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const nowSeconds = Math.floor(now / 1000);
    const entries: EventBoardEntry[] = [
      { href: "/sportsbook/1", market: market(1n, nowSeconds + 90 * 60) },
      { href: "/sportsbook/2", market: market(2n, nowSeconds - 24 * 60 * 60, "resolved") }
    ];

    render(<EventBoard entries={entries} filter="today" locale="en" showPast />);

    expect(screen.getByText("Today")).toBeDefined();
    expect(screen.queryByText("Recently settled")).toBeNull();
  });
});

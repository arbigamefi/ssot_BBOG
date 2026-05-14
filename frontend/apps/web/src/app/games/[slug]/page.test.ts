import * as React from "react";
import { describe, expect, it, vi } from "vitest";

const { gamePageClientMock } = vi.hoisted(() => ({
  gamePageClientMock: vi.fn(() => null)
}));

vi.mock("./pageClient", () => ({
  GamePageClient: gamePageClientMock
}));

import GameRoomPage from "./page";

describe("GameRoomPage", () => {
  it("renders roulette through the shared game page client", async () => {
    const page = await GameRoomPage({ params: Promise.resolve({ slug: "roulette" }) });
    expect((page as React.ReactElement).type).toBe(gamePageClientMock);
    expect((page as React.ReactElement).props.slug).toBe("roulette");
  });

  it("normalizes the legacy cointoss slug", async () => {
    const page = await GameRoomPage({ params: Promise.resolve({ slug: "cointoss" }) });
    expect((page as React.ReactElement).type).toBe(gamePageClientMock);
    expect((page as React.ReactElement).props.slug).toBe("coin-toss");
  });

  it("passes unknown slugs to the shared client so it can show release-aware fallback", async () => {
    const page = await GameRoomPage({ params: Promise.resolve({ slug: "unknown-room" }) });
    expect((page as React.ReactElement).type).toBe(gamePageClientMock);
    expect((page as React.ReactElement).props.slug).toBe("unknown-room");
  });
});

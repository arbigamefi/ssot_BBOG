import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { gamePageClientMock, notFoundMock } = vi.hoisted(() => ({
  gamePageClientMock: vi.fn(() => null),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
}));

vi.mock("./pageClient", () => ({
  GamePageClient: gamePageClientMock
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock
}));

import GameRoomPage from "./page";

describe("GameRoomPage", () => {
  beforeEach(() => {
    gamePageClientMock.mockClear();
    notFoundMock.mockClear();
  });

  it("renders roulette through the shared game page client", async () => {
    const page = await GameRoomPage({ params: Promise.resolve({ slug: "roulette" }) });
    expect((page as React.ReactElement).type).toBe(gamePageClientMock);
    expect((page as React.ReactElement).props.slug).toBe("roulette");
  });

  it("passes the canonical coin-toss slug through unchanged", async () => {
    const page = await GameRoomPage({ params: Promise.resolve({ slug: "coin-toss" }) });
    expect((page as React.ReactElement).type).toBe(gamePageClientMock);
    expect((page as React.ReactElement).props.slug).toBe("coin-toss");
  });

  it("404s unknown slugs before they reach the shared client", async () => {
    await expect(
      GameRoomPage({ params: Promise.resolve({ slug: "unknown-room" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(gamePageClientMock).toHaveBeenCalledTimes(0);
  });

  it("404s the removed cointoss slug alias", async () => {
    await expect(GameRoomPage({ params: Promise.resolve({ slug: "cointoss" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(gamePageClientMock).toHaveBeenCalledTimes(0);
  });
});

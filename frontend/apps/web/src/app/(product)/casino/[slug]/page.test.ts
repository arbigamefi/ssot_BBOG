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

// The page reads request i18n + metadata to build game-room JSON-LD; stub both
// so the server component can be invoked outside a Next request scope.
vi.mock("../../../../i18n/request", () => ({
  getRequestI18n: vi.fn(async () => ({
    messages: {
      casino: {
        room: {
          names: {
            dice: "Dice",
            roulette: "Roulette",
            coinToss: "Coin Toss",
            keno: "Keno",
            plinko: "Plinko",
            slots: "Slots",
            baccarat: "Baccarat",
            sicBo: "Sic Bo"
          }
        }
      }
    }
  }))
}));

vi.mock("../../../../features/home/fonts", () => ({
  carbonCopyFontVariables: "carbon-copy-faces"
}));

vi.mock("../../../../i18n/metadata", () => ({
  buildPageMetadata: vi.fn(() => ({ description: "Test casino room description" }))
}));

import GameRoomPage from "./page";

/** The room as a fragment: [<script ld+json>, <GamePageClient>]. The dice room wraps it in its faces. */
function room(page: unknown) {
  const element = page as React.ReactElement<{ children?: unknown; className?: string }>;
  return element.type === "div" ? (element.props.children as React.ReactElement) : element;
}

function findGameClient(page: unknown): React.ReactElement | undefined {
  const children = (room(page).props as { children?: unknown }).children;
  const list = Array.isArray(children) ? children : [children];
  return list.find(
    (child): child is React.ReactElement =>
      React.isValidElement(child) && child.type === gamePageClientMock
  );
}

describe("GameRoomPage", () => {
  beforeEach(() => {
    gamePageClientMock.mockClear();
    notFoundMock.mockClear();
  });

  it.each(["roulette", "coin-toss", "plinko", "slots", "baccarat"])(
    "renders %s through the shared game page client",
    async (slug) => {
      const page = await GameRoomPage({ params: Promise.resolve({ slug }) });
      const client = findGameClient(page);
      expect(client).toBeDefined();
      expect(client?.props.slug).toBe(slug);
    }
  );

  it("loads the Carbon copy faces for the dice room only", async () => {
    const dice = (await GameRoomPage({
      params: Promise.resolve({ slug: "dice" })
    })) as React.ReactElement<{ className?: string }>;
    expect(dice.type).toBe("div");
    expect(dice.props.className).toBe("carbon-copy-faces");
    expect(findGameClient(dice)?.props.slug).toBe("dice");

    const roulette = (await GameRoomPage({
      params: Promise.resolve({ slug: "roulette" })
    })) as React.ReactElement;
    expect(roulette.type).not.toBe("div");
  });

  it("emits game-room JSON-LD structured data", async () => {
    const page = await GameRoomPage({ params: Promise.resolve({ slug: "dice" }) });
    const children = (room(page).props as { children?: unknown }).children;
    const list = Array.isArray(children) ? children : [children];
    const script = list.find(
      (child): child is React.ReactElement =>
        React.isValidElement(child) &&
        (child.props as { type?: string }).type === "application/ld+json"
    );
    expect(script).toBeDefined();
    const json = JSON.parse(
      (script!.props as { dangerouslySetInnerHTML: { __html: string } }).dangerouslySetInnerHTML
        .__html
    );
    expect(json["@type"]).toBe("Game");
    expect(json.name).toBe("Dice");
    expect(json.url).toMatch(/\/casino\/dice$/);
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

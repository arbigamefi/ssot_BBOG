import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  })
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

import GameCompatPage from "./page";

describe("GameCompatPage", () => {
  it("redirects roulette to the canonical roulette route", async () => {
    await expect(GameCompatPage({ params: Promise.resolve({ slug: "roulette" }) })).rejects.toThrow(
      "REDIRECT:/roulette"
    );
    expect(redirectMock).toHaveBeenCalledWith("/roulette");
  });

  it("redirects coin-toss to the canonical cointoss route", async () => {
    await expect(
      GameCompatPage({ params: Promise.resolve({ slug: "coin-toss" }) })
    ).rejects.toThrow("REDIRECT:/cointoss");
    expect(redirectMock).toHaveBeenCalledWith("/cointoss");
  });

  it("falls back to the games directory for unknown slugs", async () => {
    await expect(
      GameCompatPage({ params: Promise.resolve({ slug: "unknown-room" }) })
    ).rejects.toThrow("REDIRECT:/games");
    expect(redirectMock).toHaveBeenCalledWith("/games");
  });
});

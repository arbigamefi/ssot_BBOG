import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  })
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

import LiquidityCompatPage from "./page";

describe("LiquidityCompatPage", () => {
  it("redirects liquidity to the canonical earn route", () => {
    expect(() => LiquidityCompatPage()).toThrow("REDIRECT:/earn");
    expect(redirectMock).toHaveBeenCalledWith("/earn");
  });
});

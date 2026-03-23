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
  it("redirects liquidity to the canonical invest route", () => {
    expect(() => LiquidityCompatPage()).toThrow("REDIRECT:/invest");
    expect(redirectMock).toHaveBeenCalledWith("/invest");
  });
});

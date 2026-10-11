import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStageReveal } from "./use-stage-reveal";

describe("useStageReveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reveals after the game's animation time when no callback arrives", () => {
    const { result } = renderHook(() => useStageReveal());
    act(() => result.current.startStageReveal(7n, "dice"));
    expect(result.current.stageReveal).toEqual({ betId: 7n, phase: "revealing" });
    act(() => {
      vi.advanceTimersByTime(1_999);
    });
    expect(result.current.stageReveal?.phase).toBe("revealing");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.stageReveal).toEqual({ betId: 7n, phase: "revealed" });
  });

  it("lets the animation's callback finish the reveal early", () => {
    const { result } = renderHook(() => useStageReveal());
    act(() => result.current.startStageReveal(8n, "plinko"));
    act(() => result.current.completeStageReveal());
    expect(result.current.stageReveal).toEqual({ betId: 8n, phase: "revealed" });
  });

  it("reveals at once for a game without an animation time", () => {
    const { result } = renderHook(() => useStageReveal());
    act(() => result.current.startStageReveal(9n, "unknown-game"));
    expect(result.current.stageReveal).toEqual({ betId: 9n, phase: "revealed" });
  });

  it("clears the reveal and its timer, so a stale timer cannot bring it back", () => {
    const { result } = renderHook(() => useStageReveal());
    act(() => result.current.startStageReveal(10n, "roulette"));
    act(() => result.current.clearStageReveal());
    expect(result.current.stageReveal).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.stageReveal).toBeNull();
  });
});

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
    act(() => result.current.startStageReveal(7n, "sic-bo"));
    expect(result.current.stageReveal).toEqual({ betId: 7n, phase: "revealing" });
    act(() => {
      vi.advanceTimersByTime(2_099);
    });
    expect(result.current.stageReveal?.phase).toBe("revealing");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.stageReveal).toEqual({ betId: 7n, phase: "revealed" });
  });

  it("gives the dice ball time for every round's deadline", () => {
    const { result } = renderHook(() => useStageReveal());
    act(() => result.current.startStageReveal(6n, "dice", 3));
    act(() => {
      vi.advanceTimersByTime(9_499);
    });
    expect(result.current.stageReveal?.phase).toBe("revealing");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.stageReveal?.phase).toBe("revealed");
  });

  it("gives the roulette ball time for every round's deadline", () => {
    const { result } = renderHook(() => useStageReveal());
    act(() => result.current.startStageReveal(5n, "roulette", 2));
    act(() => {
      vi.advanceTimersByTime(9_799);
    });
    expect(result.current.stageReveal?.phase).toBe("revealing");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.stageReveal?.phase).toBe("revealed");
  });

  it("gives the slot reels time for every round's deadline", () => {
    const { result } = renderHook(() => useStageReveal());
    act(() => result.current.startStageReveal(4n, "slots", 3));
    act(() => {
      vi.advanceTimersByTime(12_299);
    });
    expect(result.current.stageReveal?.phase).toBe("revealing");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.stageReveal?.phase).toBe("revealed");
  });

  it("gives the keno blower time for every round's deadline", () => {
    const { result } = renderHook(() => useStageReveal());
    act(() => result.current.startStageReveal(6n, "keno", 2));
    act(() => {
      vi.advanceTimersByTime(8_799);
    });
    expect(result.current.stageReveal?.phase).toBe("revealing");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.stageReveal?.phase).toBe("revealed");
  });

  it("gives the plinko balls time for every ball's deadline", () => {
    const { result } = renderHook(() => useStageReveal());
    act(() => result.current.startStageReveal(7n, "plinko", 5));
    act(() => {
      vi.advanceTimersByTime(6_599);
    });
    expect(result.current.stageReveal?.phase).toBe("revealing");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.stageReveal?.phase).toBe("revealed");
  });

  it("gives the coin time for every flip's deadline", () => {
    const { result } = renderHook(() => useStageReveal());
    act(() => result.current.startStageReveal(9n, "coin-toss", 3));
    act(() => {
      vi.advanceTimersByTime(5_899);
    });
    expect(result.current.stageReveal?.phase).toBe("revealing");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.stageReveal?.phase).toBe("revealed");
  });

  it("lets the animation's callback finish the reveal early", () => {
    const { result } = renderHook(() => useStageReveal());
    act(() => result.current.startStageReveal(8n, "baccarat"));
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

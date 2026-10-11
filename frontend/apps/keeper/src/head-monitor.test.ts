import { describe, expect, it, vi } from "vitest";
import { HeadMonitor } from "./head-monitor.js";

function monitor() {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  let now = 1_000;
  const head = new HeadMonitor({
    scanner: "test-scan",
    head: "finalized",
    logger,
    now: () => now
  });
  return { head, logger, advance: (ms: number) => (now += ms) };
}

describe("HeadMonitor", () => {
  it("follows a head that only moves forward", () => {
    const { head, logger } = monitor();
    expect(head.observe(100n)).toEqual({ target: 100n, highest: 100n });
    expect(head.observe(100n)).toEqual({ target: 100n, highest: 100n });
    expect(head.observe(120n)).toEqual({ target: 120n, highest: 120n });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("reports a lagging read without raising, and warns once per occurrence", () => {
    const { head, logger, advance } = monitor();
    head.observe(47_969_422n);
    // Production 2026-10-11: two load-balanced nodes disagreed about the finalized block.
    expect(head.observe(47_969_244n)).toEqual({
      target: 47_969_244n,
      highest: 47_969_422n,
      behindBy: 178n
    });
    expect(head.observe(47_969_300n)).toMatchObject({ target: 47_969_300n, behindBy: 122n });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith("casino.keeper.head_behind", {
      scanner: "test-scan",
      head: "finalized",
      reportedBlock: "47969244",
      highestBlock: "47969422",
      behindBy: "178"
    });
    advance(30_000);
    expect(head.observe(47_969_422n)).toEqual({ target: 47_969_422n, highest: 47_969_422n });
    expect(logger.info).toHaveBeenCalledWith("casino.keeper.head_caught_up", {
      scanner: "test-scan",
      head: "finalized",
      block: "47969422",
      behindForMs: 30_000
    });
    head.observe(47_969_400n);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it("treats a read below a persisted cursor as lagging", () => {
    const { head } = monitor();
    head.seed(500n);
    head.seed(400n);
    expect(head.observe(450n)).toEqual({ target: 450n, highest: 500n, behindBy: 50n });
    expect(head.observe(501n)).toEqual({ target: 501n, highest: 501n });
  });

  it("reports a head that has not advanced for the stall limit, lagging reads included", () => {
    let now = 0;
    const head = new HeadMonitor({
      scanner: "test-scan",
      head: "finalized",
      now: () => now,
      stallMs: 3_600_000
    });
    expect(head.observe(100n).stalledSince).toBeUndefined();
    now = 3_599_999;
    expect(head.observe(100n).stalledSince).toBeUndefined();
    now = 3_600_000;
    expect(head.observe(100n)).toEqual({ target: 100n, highest: 100n, stalledSince: 0 });
    // A lagging read neither advances the head nor hides the stall.
    expect(head.observe(90n)).toEqual({
      target: 90n,
      highest: 100n,
      behindBy: 10n,
      stalledSince: 0
    });
    now = 3_700_000;
    expect(head.observe(101n)).toEqual({ target: 101n, highest: 101n });
    // Without a limit nothing stalls.
    const unlimited = new HeadMonitor({ scanner: "test-scan", head: "finalized", now: () => now });
    unlimited.observe(5n);
    now += 10 * 3_600_000;
    expect(unlimited.observe(5n).stalledSince).toBeUndefined();
  });
});

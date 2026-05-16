import { describe, expect, it } from "vitest";
import { FinalizeQueue } from "./queue.js";

function event(betId: bigint, receivedAt = 1_000) {
  return { source: "gameHub" as const, betId, receivedAt };
}

describe("FinalizeQueue", () => {
  it("deduplicates bet ids and keeps the earliest availability", () => {
    let now = 1_000;
    const queue = new FinalizeQueue(() => now);

    queue.enqueue(event(7n), 10_000);
    queue.enqueue({ ...event(7n), requestId: 99n }, 5_000);

    expect(queue.size).toBe(1);
    now = 6_000;
    expect(queue.nextReady()?.requestId).toBe(99n);
  });

  it("tracks in-flight items and retry scheduling", () => {
    let now = 1_000;
    const queue = new FinalizeQueue(() => now);

    queue.enqueue(event(1n));
    const item = queue.nextReady();
    expect(item?.betId).toBe(1n);
    expect(queue.has(1n)).toBe(true);

    const retry = queue.retry(item!, 2_000);
    expect(retry.attempts).toBe(1);
    now = 2_000;
    expect(queue.nextReady()).toBeUndefined();
    now = 3_000;
    expect(queue.nextReady()?.betId).toBe(1n);
  });
});

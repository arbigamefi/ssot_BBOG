import { describe, expect, it } from "vitest";
import { FinalizeQueue } from "./queue.js";

function event(betId: bigint, receivedAt = 1_000) {
  return { source: "gameHub" as const, betId, receivedAt };
}

describe("FinalizeQueue", () => {
  it("does not let an in-flight pending retry overwrite a newly received ready event", () => {
    const queue = new FinalizeQueue(() => 1_000);
    queue.enqueue({ source: "scan", betId: 1n, receivedAt: 900 });
    const pending = queue.nextReady()!;
    queue.enqueue({ ...event(1n), requestId: 42n, blockNumber: 99n });
    expect(queue.nextReady()).toBeUndefined(); // A single bet never has two writers.
    queue.retry(pending, 60_000);
    const ready = queue.nextReady();
    expect(ready).toMatchObject({ betId: 1n, requestId: 42n, blockNumber: 99n, attempts: 1 });
    expect(queue.nextReady()).toBeUndefined();
  });

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

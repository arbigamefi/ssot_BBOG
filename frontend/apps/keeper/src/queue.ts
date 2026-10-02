import type { KeeperEvent } from "./types.js";

export type QueueItem = KeeperEvent & {
  availableAt: number;
  attempts: number;
};

export class FinalizeQueue {
  private readonly queued = new Map<string, QueueItem>();
  private readonly inFlight = new Set<string>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  enqueue(event: KeeperEvent, delayMs = 0) {
    const key = event.betId.toString();
    const existing = this.queued.get(key);
    if (existing) {
      existing.availableAt = Math.min(existing.availableAt, this.now() + delayMs);
      existing.blockNumber = event.blockNumber ?? existing.blockNumber;
      existing.txHash = event.txHash ?? existing.txHash;
      existing.requestId = event.requestId ?? existing.requestId;
      return existing;
    }

    const item: QueueItem = {
      ...event,
      availableAt: this.now() + delayMs,
      attempts: 0
    };
    this.queued.set(key, item);
    return item;
  }

  nextReady() {
    const now = this.now();
    const ready = [...this.queued.values()]
      .filter((item) => item.availableAt <= now && !this.inFlight.has(item.betId.toString()))
      .sort((a, b) => a.availableAt - b.availableAt || Number(a.betId - b.betId));

    const item = ready[0];
    if (!item) return undefined;
    this.queued.delete(item.betId.toString());
    this.inFlight.add(item.betId.toString());
    return item;
  }

  complete(betId: bigint) {
    this.inFlight.delete(betId.toString());
  }

  retry(item: QueueItem, delayMs: number) {
    const key = item.betId.toString();
    this.inFlight.delete(key);
    // A ready event can arrive while the PendingVRF read is still in flight.
    // Preserve that event and its earlier wakeup instead of reinstating an old delay.
    const queued = this.queued.get(key);
    const next = {
      ...item,
      ...queued,
      attempts: Math.max(item.attempts, queued?.attempts ?? 0) + 1,
      availableAt: Math.min(this.now() + delayMs, queued?.availableAt ?? Infinity)
    };
    this.queued.set(key, next);
    return next;
  }

  has(betId: bigint) {
    const key = betId.toString();
    return this.queued.has(key) || this.inFlight.has(key);
  }

  get size() {
    return this.queued.size + this.inFlight.size;
  }
}

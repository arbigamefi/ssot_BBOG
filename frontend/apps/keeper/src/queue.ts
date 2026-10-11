import type { KeeperEvent } from "./types.js";

export type QueueItem = KeeperEvent & {
  availableAt: number;
  attempts: number;
};

/** The earlier of two result blocks: the first event that showed the result dates its receipt. */
function earliest(a: bigint | undefined, b: bigint | undefined) {
  if (a == null) return b;
  if (b == null) return a;
  return a < b ? a : b;
}

export class FinalizeQueue {
  private readonly queued = new Map<string, QueueItem>();
  private readonly inFlight = new Map<string, QueueItem>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  enqueue(event: KeeperEvent, delayMs = 0) {
    const key = event.betId.toString();
    const existing = this.queued.get(key);
    if (existing) {
      existing.availableAt = Math.min(existing.availableAt, this.now() + delayMs);
      existing.blockNumber = event.blockNumber ?? existing.blockNumber;
      existing.txHash = event.txHash ?? existing.txHash;
      existing.requestId = event.requestId ?? existing.requestId;
      existing.resultBlockNumber = earliest(existing.resultBlockNumber, event.resultBlockNumber);
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
    this.inFlight.set(item.betId.toString(), item);
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
      resultBlockNumber: earliest(item.resultBlockNumber, queued?.resultBlockNumber),
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

  /**
   * Whether a bet with a lower ID is queued or in flight but has never been examined. Bet IDs grow with
   * VRF request time, so the void executor waits for these before voiding a later bet.
   */
  hasUnexaminedBefore(betId: bigint) {
    for (const items of [this.queued.values(), this.inFlight.values()])
      for (const item of items) if (item.attempts === 0 && item.betId < betId) return true;
    return false;
  }

  get size() {
    return this.queued.size + this.inFlight.size;
  }
}

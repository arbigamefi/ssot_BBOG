import { isUnknownBlockError } from "./errors.js";

/** An unknown-block run degrades health only after this long without a success in between. */
export const UNKNOWN_BLOCK_GRACE_MS = 300_000;

/**
 * Reads pinned to a block number can reach a load-balanced RPC node that does not have that block
 * yet and answer "header not found" or "unknown block". Such a failure is transient: it is reported
 * only once it has persisted for five consecutive minutes, and any success ends the run. Every other
 * failure is reported at once.
 */
export class UnknownBlockGrace {
  private readonly runs = new Map<string, number>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly graceMs = UNKNOWN_BLOCK_GRACE_MS
  ) {}

  /** Whether this failure of `key` must degrade health now. */
  report(key: string, error: unknown) {
    if (!isUnknownBlockError(error)) {
      this.runs.delete(key);
      return true;
    }
    const since = this.runs.get(key) ?? this.now();
    this.runs.set(key, since);
    return this.now() - since >= this.graceMs;
  }

  succeed(key: string) {
    this.runs.delete(key);
  }

  /** Start of the current unknown-block run of `key`, in milliseconds. */
  since(key: string) {
    return this.runs.get(key);
  }
}

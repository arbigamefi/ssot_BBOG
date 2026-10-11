import type { KeeperLogger } from "./types.js";

export type HeadObservation = {
  /** What this read reports. A scan goes no further than it, which is nothing when it is behind the cursor. */
  target: bigint;
  /** Highest block any read, or a persisted cursor, has shown for this head. */
  highest: bigint;
  /** How far this read is below `highest`; absent when it is not behind. */
  behindBy?: bigint;
  /** When the head last advanced, in milliseconds, if that is longer ago than the stall limit. */
  stalledSince?: number;
};

/**
 * Base never moves the latest or finalized block back, but load-balanced HTTP RPC nodes can disagree,
 * so one read may report an older block than an earlier one (production 2026-10-11: finalized
 * 47969422, then 47969244). That read is not an error: the scanner keeps its monotonic cursor, scans
 * nothing past what the read reports and resumes once the provider catches up, so no event is skipped.
 * Health records how far behind the read was. The log warns once when a read first falls behind.
 *
 * Independently, a head whose highest block has not advanced for `stallMs` is reported as stalled.
 */
export class HeadMonitor {
  private highest: bigint | undefined;
  private advancedAt: number | undefined;
  private behindSince: number | undefined;

  constructor(
    private readonly options: {
      scanner: string;
      head: "latest" | "finalized";
      logger?: KeeperLogger;
      now?: () => number;
      /** Zero or absent: never stalled. */
      stallMs?: number;
    }
  ) {}

  /** Raises the known head without a read, for example to a cursor persisted at a finalized block. */
  seed(block: bigint) {
    if (this.highest == null || block > this.highest) this.highest = block;
  }

  observe(reported: bigint): HeadObservation {
    const now = (this.options.now ?? Date.now)();
    if (this.highest == null || reported > this.highest) {
      this.highest = reported;
      this.advancedAt = now;
    }
    this.advancedAt ??= now;
    const highest = this.highest;
    const stallMs = this.options.stallMs ?? 0;
    const stalled = stallMs > 0 && now - this.advancedAt >= stallMs;
    const stall = stalled ? { stalledSince: this.advancedAt } : {};
    if (reported >= highest) {
      if (this.behindSince != null) {
        this.options.logger?.info("casino.keeper.head_caught_up", {
          scanner: this.options.scanner,
          head: this.options.head,
          block: reported.toString(),
          behindForMs: now - this.behindSince
        });
        this.behindSince = undefined;
      }
      return { target: reported, highest, ...stall };
    }
    const behindBy = highest - reported;
    if (this.behindSince == null) {
      this.behindSince = now;
      this.options.logger?.warn("casino.keeper.head_behind", {
        scanner: this.options.scanner,
        head: this.options.head,
        reportedBlock: reported.toString(),
        highestBlock: highest.toString(),
        behindBy: behindBy.toString()
      });
    }
    return { target: reported, highest, behindBy, ...stall };
  }
}

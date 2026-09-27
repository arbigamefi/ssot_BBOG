import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "./logger.js";

describe("keeper logger", () => {
  const lines: Record<"log" | "warn" | "error", string[]> = { log: [], warn: [], error: [] };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T16:11:29.000Z"));
    for (const stream of ["log", "warn", "error"] as const) {
      lines[stream] = [];
      vi.spyOn(console, stream).mockImplementation((...args: unknown[]) => {
        lines[stream].push(String(args[0]));
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const lastLine = (stream: "log" | "warn" | "error") =>
    JSON.parse(lines[stream].at(-1)!) as Record<string, unknown>;

  it("keeps the event name when an untyped caller passes error text as message", () => {
    // The shape every watcher used to send; the empty text replaced the event name.
    const fields: Record<string, unknown> = { eventName: "BetPlaced", message: "" };

    logger.error("casino.keeper.gamehub_index_watch_error", fields);

    expect(lines.error).toHaveLength(1);
    expect(lastLine("error")).toEqual({
      level: "error",
      message: "casino.keeper.gamehub_index_watch_error",
      ts: "2026-09-26T16:11:29.000Z",
      eventName: "BetPlaced",
      error: ""
    });
    expect(Object.keys(lastLine("error")).slice(0, 3)).toEqual(["level", "message", "ts"]);
  });

  it("never lets a field replace level or ts", () => {
    const fields: Record<string, unknown> = { level: "debug", ts: "yesterday", chainId: 8453 };

    logger.info("casino.keeper.starting", fields);

    expect(lastLine("log")).toEqual({
      level: "info",
      message: "casino.keeper.starting",
      ts: "2026-09-26T16:11:29.000Z",
      chainId: 8453
    });
  });

  it("keeps an explicit error over a stray message", () => {
    const fields: Record<string, unknown> = { message: "stale text", error: "Error: current" };

    logger.warn("casino.finalize.receipt_materialize_failed", fields);

    expect(lastLine("warn")).toMatchObject({
      message: "casino.finalize.receipt_materialize_failed",
      error: "Error: current"
    });
  });

  it("writes no URL, even one nested in a field", () => {
    logger.error("casino.keeper.scan_failed", {
      error: "HTTP request failed. URL: https://base-mainnet.infura.io/v3/infura-key-123",
      outcome: { reason: "The socket has been closed. URL: wss://example.invalid/v2/alchemy-key" }
    });

    const line = lines.error.at(-1)!;
    expect(line).not.toContain("infura-key-123");
    expect(line).not.toContain("alchemy-key");
    expect(lastLine("error")).toMatchObject({
      error: "HTTP request failed. URL: [redacted-url]",
      outcome: { reason: "The socket has been closed. URL: [redacted-url]" }
    });
  });

  it("writes one JSON line per call to the stream for its level", () => {
    logger.info("casino.keeper.enqueued", { betId: "1" });
    logger.warn("casino.keeper.retry_scheduled", { betId: "1" });
    logger.error("casino.keeper.process_failed", { betId: "1", error: "Error: boom" });

    expect(lines.log).toHaveLength(1);
    expect(lines.warn).toHaveLength(1);
    expect(lines.error).toHaveLength(1);
    expect(lastLine("log")).toMatchObject({ level: "info", message: "casino.keeper.enqueued" });
    expect(lastLine("warn")).toMatchObject({
      level: "warn",
      message: "casino.keeper.retry_scheduled"
    });
    expect(lastLine("error")).toMatchObject({
      level: "error",
      message: "casino.keeper.process_failed",
      error: "Error: boom"
    });
  });
});

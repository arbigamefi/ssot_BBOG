import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadKeeperConfig } from "./env.js";

const PRIVATE_KEY = `0x${"1".repeat(64)}` as const;

function writeRelease(sportsHub = "0x0000000000000000000000000000000000000003") {
  const dir = mkdtempSync(join(tmpdir(), "keeper-env-"));
  const path = join(dir, "chain-84532.json");
  writeFileSync(
    path,
    JSON.stringify({
      chainId: 84532,
      contracts: {
        gameHub: "0x0000000000000000000000000000000000000001",
        sportsHub,
        vrfHub: "0x0000000000000000000000000000000000000002"
      },
      meta: { blockNumber: 123 }
    })
  );
  return path;
}

function baseEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    KEEPER_RELEASE_PATH: writeRelease(),
    KEEPER_RPC_HTTP: "https://keeper-rpc.example",
    KEEPER_PRIVATE_KEY: PRIVATE_KEY,
    ...overrides
  };
}

describe("loadKeeperConfig", () => {
  it("defaults to an Alchemy-free-tier-safe scan window", () => {
    const config = loadKeeperConfig(baseEnv());

    expect(config.scanChunkBlocks).toBe(10n);
    expect(config.sportsTerminalizerScanChunkBlocks).toBe(10n);
    expect(config.sportsTicketScanChunkBlocks).toBe(10n);
  });

  it("bounds a catch-up pass, with headroom over Base's block rate", () => {
    const config = loadKeeperConfig(baseEnv());

    // A 300s pass must cover at least ~15 chunks to keep pace with 2s blocks at
    // the 10-block free-tier chunk size; anything lower falls behind forever.
    expect(config.scanMaxChunksPerPass).toBe(50);
    expect(config.scanMaxChunksPerPass).toBeGreaterThan(15);
  });

  it("allows the catch-up bound to be raised for providers with wider log ranges", () => {
    const config = loadKeeperConfig(baseEnv({ KEEPER_SCAN_MAX_CHUNKS_PER_PASS: "400" }));

    expect(config.scanMaxChunksPerPass).toBe(400);
  });

  it("rejects a catch-up bound that would stall the scanner", () => {
    expect(() => loadKeeperConfig(baseEnv({ KEEPER_SCAN_MAX_CHUNKS_PER_PASS: "0" }))).toThrow(
      /KEEPER_SCAN_MAX_CHUNKS_PER_PASS/
    );
  });

  it("bounds each durable sports history pass", () => {
    const config = loadKeeperConfig(baseEnv());

    // Completed chunks persist; this is a per-pass budget, not a deployment age limit.
    expect(config.sportsTicketScanMaxBlocks).toBe(50_000n);
  });

  it("requires durable storage for sports but keeps database-free casino configuration valid", () => {
    expect(() => loadKeeperConfig(baseEnv())).not.toThrow();
    expect(() => loadKeeperConfig(baseEnv({ KEEPER_SPORTS_TERMINALIZER_ENABLED: "true" }))).toThrow(
      /BET_INDEX_DATABASE_URL/
    );
    expect(() => loadKeeperConfig(baseEnv({ KEEPER_SPORTS_TICKET_INDEX_ENABLED: "true" }))).toThrow(
      /BET_INDEX_DATABASE_URL/
    );
    expect(() =>
      loadKeeperConfig(
        baseEnv({
          KEEPER_SPORTS_TERMINALIZER_ENABLED: "true",
          BET_INDEX_WRITE_ENABLED: "true",
          BET_INDEX_DATABASE_URL: "postgres://local/test"
        })
      )
    ).not.toThrow();
  });

  it("rejects moving sports history past the release block", () => {
    expect(() =>
      loadKeeperConfig(
        baseEnv({
          KEEPER_SPORTS_TERMINALIZER_ENABLED: "true",
          BET_INDEX_WRITE_ENABLED: "true",
          BET_INDEX_DATABASE_URL: "postgres://local/test",
          KEEPER_SPORTS_TICKET_SCAN_START_BLOCK: "124"
        })
      )
    ).toThrow(/must include the release block/);
  });

  it("rejects enabling sports against an undeployed zero-address release", () => {
    const releasePath = writeRelease("0x0000000000000000000000000000000000000000");
    expect(() => loadKeeperConfig(baseEnv({ KEEPER_RELEASE_PATH: releasePath }))).not.toThrow();
    expect(() =>
      loadKeeperConfig(
        baseEnv({
          KEEPER_RELEASE_PATH: releasePath,
          KEEPER_SPORTS_TERMINALIZER_ENABLED: "true",
          BET_INDEX_WRITE_ENABLED: "true",
          BET_INDEX_DATABASE_URL: "postgres://local/test"
        })
      )
    ).toThrow(/sportsHub/);
  });

  it("names the offending variable when a block count is invalid", () => {
    // The shared parser used to report KEEPER_SCAN_CHUNK_BLOCKS whichever
    // variable actually failed, which sends operators to the wrong line.
    expect(() => loadKeeperConfig(baseEnv({ KEEPER_SPORTS_TICKET_SCAN_MAX_BLOCKS: "0" }))).toThrow(
      /KEEPER_SPORTS_TICKET_SCAN_MAX_BLOCKS/
    );
    expect(() =>
      loadKeeperConfig(baseEnv({ KEEPER_SPORTS_TICKET_SCAN_CHUNK_BLOCKS: "0" }))
    ).toThrow(/KEEPER_SPORTS_TICKET_SCAN_CHUNK_BLOCKS/);
  });

  it("parses the optional in-process RPC throttle interval", () => {
    const config = loadKeeperConfig(baseEnv({ KEEPER_RPC_MIN_INTERVAL_MS: "1250" }));

    expect(config.rpcMinIntervalMs).toBe(1250);
  });

  it("enables startup scans and fallback index scans by default", () => {
    const config = loadKeeperConfig(baseEnv());

    expect(config.startupScanEnabled).toBe(true);
    expect(config.scanIndexEventsEnabled).toBe(true);
  });

  it("parses production websocket scan mode toggles", () => {
    const config = loadKeeperConfig(
      baseEnv({
        KEEPER_SCAN_INDEX_EVENTS_ENABLED: "false",
        KEEPER_STARTUP_SCAN_ENABLED: "false"
      })
    );

    expect(config.scanIndexEventsEnabled).toBe(false);
    expect(config.startupScanEnabled).toBe(false);
  });

  it("rejects a negative RPC throttle interval", () => {
    expect(() => loadKeeperConfig(baseEnv({ KEEPER_RPC_MIN_INTERVAL_MS: "-1" }))).toThrow(
      /KEEPER_RPC_MIN_INTERVAL_MS must be a non-negative number/
    );
  });
});

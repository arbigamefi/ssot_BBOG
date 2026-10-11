import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadKeeperConfig } from "./env.js";

const PRIVATE_KEY = `0x${"1".repeat(64)}` as const;

function writeRelease() {
  const dir = mkdtempSync(join(tmpdir(), "keeper-env-"));
  const path = join(dir, "chain-84532.json");
  writeFileSync(
    path,
    JSON.stringify({
      chainId: 84532,
      contracts: {
        gameHub: "0x0000000000000000000000000000000000000001",
        vrfHub: "0x0000000000000000000000000000000000000002",
        poolRegistry: "0x0000000000000000000000000000000000000066"
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

  it("names the offending variable when the scan chunk size is invalid", () => {
    expect(() => loadKeeperConfig(baseEnv({ KEEPER_SCAN_CHUNK_BLOCKS: "0" }))).toThrow(
      /KEEPER_SCAN_CHUNK_BLOCKS/
    );
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

describe("casino lifecycle recovery configuration", () => {
  it("binds recovery to release history instead of an operator's advanced normal cursor", () => {
    const config = loadKeeperConfig(baseEnv({ KEEPER_START_BLOCK: "999999" }));
    expect(config.startBlock).toBe(999999n);
    expect(config.casinoRecoveryStartBlock).toBe(123n);
  });
  it("permits widening history but rejects skipping the release block", () => {
    expect(
      loadKeeperConfig(baseEnv({ KEEPER_CASINO_RECOVERY_START_BLOCK: "100" }))
        .casinoRecoveryStartBlock
    ).toBe(100n);
    expect(() => loadKeeperConfig(baseEnv({ KEEPER_CASINO_RECOVERY_START_BLOCK: "124" }))).toThrow(
      /PendingVRF/
    );
  });
});

it("only reconciles the active pools in the current release", () => {
  const path = writeRelease();
  writeFileSync(
    path,
    JSON.stringify({
      chainId: 84532,
      contracts: {
        gameHub: "0x0000000000000000000000000000000000000001",
        vrfHub: "0x0000000000000000000000000000000000000002",
        poolRegistry: "0x0000000000000000000000000000000000000066"
      },
      pools: [
        {
          poolId: 7,
          asset: "0x0000000000000000000000000000000000000003",
          vault: "0x0000000000000000000000000000000000000008",
          bank: "0x0000000000000000000000000000000000000004",
          active: false
        }
      ],
      meta: { blockNumber: 123 }
    })
  );
  const config = loadKeeperConfig(baseEnv({ KEEPER_RELEASE_PATH: path }));
  expect(config.vaultProviderLedgerPools).toEqual([]);
  // Governance is checked on every Bank of the release, inactive pools included.
  expect(config.releaseBanks).toEqual(["0x0000000000000000000000000000000000000004"]);
  expect(config.poolRegistry).toBe("0x0000000000000000000000000000000000000066");
});

it("refuses a release without its PoolRegistry, whose governance is the timelock to index", () => {
  const path = writeRelease();
  writeFileSync(
    path,
    JSON.stringify({
      chainId: 84532,
      contracts: {
        gameHub: "0x0000000000000000000000000000000000000001",
        vrfHub: "0x0000000000000000000000000000000000000002"
      },
      meta: { blockNumber: 123 }
    })
  );
  expect(() => loadKeeperConfig(baseEnv({ KEEPER_RELEASE_PATH: path }))).toThrow(
    /Invalid keeper release file/
  );
});

describe("void gas limit", () => {
  it("defaults to 11,000,000", () => {
    expect(loadKeeperConfig(baseEnv()).voidGasLimit).toBe(11_000_000n);
  });

  it("accepts an override up to 16,000,000", () => {
    expect(loadKeeperConfig(baseEnv({ KEEPER_VOID_GAS_LIMIT: "16000000" })).voidGasLimit).toBe(
      16_000_000n
    );
  });

  it.each(["16000001", "16777216"])("rejects %s, above Base's per-transaction cap", (value) => {
    expect(() => loadKeeperConfig(baseEnv({ KEEPER_VOID_GAS_LIMIT: value }))).toThrow(
      /KEEPER_VOID_GAS_LIMIT must be at most 16000000/
    );
  });

  it.each(["11e6", "-1", "1.5", "eleven"])("rejects the malformed value %s", (value) => {
    expect(() => loadKeeperConfig(baseEnv({ KEEPER_VOID_GAS_LIMIT: value }))).toThrow(
      /KEEPER_VOID_GAS_LIMIT must be a positive integer/
    );
  });
});

describe("finalized stall limit", () => {
  it("defaults to one hour and accepts seconds, zero disabling it", () => {
    expect(loadKeeperConfig(baseEnv()).finalizedStallMs).toBe(3_600_000);
    expect(
      loadKeeperConfig(baseEnv({ KEEPER_FINALIZED_STALL_SECONDS: "900" })).finalizedStallMs
    ).toBe(900_000);
    expect(
      loadKeeperConfig(baseEnv({ KEEPER_FINALIZED_STALL_SECONDS: "0" })).finalizedStallMs
    ).toBe(0);
  });

  it("rejects a negative or malformed value", () => {
    for (const value of ["-1", "an hour"])
      expect(() => loadKeeperConfig(baseEnv({ KEEPER_FINALIZED_STALL_SECONDS: value }))).toThrow(
        /KEEPER_FINALIZED_STALL_SECONDS must be a non-negative number of seconds/
      );
  });
});

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPayableStateFile } from "./payables-state.js";

const bank = "0x00000000000000000000000000000000000000bb" as const;
const alice = getAddress("0x00000000000000000000000000000000000000a1");
const hash = `0x${"ab".repeat(32)}` as const;
const valid = {
  schemaVersion: 1,
  chainId: 8453,
  bank,
  origin: "10",
  scannedThrough: "100",
  scannedThroughHash: hash,
  players: [alice]
};

describe("payable state file", () => {
  let dir: string;
  let path: string;
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const store = () =>
    createPayableStateFile({ stateDir: dir, chainId: 8453, bank, origin: 10n, logger });

  beforeEach(async () => {
    dir = join(await mkdtemp(join(tmpdir(), "keeper-payables-state-")), "state");
    path = join(dir, `payables-8453-${bank}.json`);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(join(dir, ".."), { recursive: true, force: true });
  });

  it("has nothing to load before the first save, without a warning", async () => {
    expect(await store().load()).toBeUndefined();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("saves one file per chain and Bank, replaced on each save, and loads it back", async () => {
    await store().save({ scannedThrough: 99n, scannedThroughHash: hash, players: [] });
    await store().save({ scannedThrough: 100n, scannedThroughHash: hash, players: [alice] });
    expect(await readdir(dir)).toEqual([`payables-8453-${bank}.json`]);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(valid);
    expect(await store().load()).toEqual({
      scannedThrough: 100n,
      scannedThroughHash: hash,
      players: [alice]
    });
  });

  it("checksums and deduplicates loaded players", async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(path, JSON.stringify({ ...valid, players: [alice.toLowerCase(), alice] }));
    expect((await store().load())?.players).toEqual([alice]);
  });

  it.each([
    ["another chain", { chainId: 84532 }, "chainId 84532 is not 8453"],
    ["another Bank", { bank: alice }, `bank ${alice} is not ${bank}`],
    ["another origin", { origin: "11" }, "origin 11 is not 10"],
    ["another schema", { schemaVersion: 2 }, "schemaVersion 2 is not 1"],
    ["a cursor before the origin", { scannedThrough: "9" }, "scannedThrough 9 is not"],
    ["a numeric cursor", { scannedThrough: 100 }, "scannedThrough 100 is not"],
    ["a short hash", { scannedThroughHash: "0x12" }, "scannedThroughHash is not a block hash"],
    ["a player that is not an address", { players: ["alice"] }, "players is not a list"]
  ])("ignores and logs a state with %s", async (_name, change, reason) => {
    await mkdir(dir, { recursive: true });
    await writeFile(path, JSON.stringify({ ...valid, ...change }));
    expect(await store().load()).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith("casino.keeper.payables_state_ignored", {
      bank,
      path,
      reason: expect.stringContaining(reason)
    });
  });

  it("ignores and logs a file that is not JSON, and one that cannot be read", async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(path, "{");
    expect(await store().load()).toBeUndefined();
    expect(logger.warn).toHaveBeenLastCalledWith(
      "casino.keeper.payables_state_ignored",
      expect.objectContaining({ reason: "not JSON" })
    );
    await rm(path);
    await mkdir(path);
    expect(await store().load()).toBeUndefined();
    expect(logger.warn).toHaveBeenLastCalledWith(
      "casino.keeper.payables_state_ignored",
      expect.objectContaining({ reason: expect.stringContaining("EISDIR") })
    );
  });
});

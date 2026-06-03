import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readKeeperHealthSnapshot } from "./keeper-health";

const originalEnv = process.env;

function runningSnapshot(chainId: number, keeper = `0x${"33".repeat(20)}`) {
  return {
    schemaVersion: 1,
    status: "running",
    role: "primary",
    chainId,
    gameHub: `0x${"11".repeat(20)}`,
    vrfHub: `0x${"22".repeat(20)}`,
    keeper,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    queueDepth: 0
  };
}

describe("readKeeperHealthSnapshot", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "keeper-health-reader-"));
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    process.env = originalEnv;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("uses the generic keeper health path for non-default local dev chains", async () => {
    const healthPath = join(tempDir, "casino-keeper-health.json");
    await writeFile(healthPath, JSON.stringify(runningSnapshot(84532)), "utf8");
    process.env.NEXT_PUBLIC_CHAIN_ID = "8453";
    process.env.KEEPER_HEALTH_PATH = healthPath;

    const snapshot = await readKeeperHealthSnapshot({ chainId: 84532 });

    expect(snapshot).toMatchObject({
      status: "running",
      chainId: 84532,
      keeper: `0x${"33".repeat(20)}`
    });
  });

  it("prefers a chain-specific keeper health path over the generic path", async () => {
    const genericPath = join(tempDir, "casino-keeper-health.json");
    const chainPath = join(tempDir, "casino-keeper-health-84532.json");
    await writeFile(
      genericPath,
      JSON.stringify(runningSnapshot(84532, `0x${"44".repeat(20)}`)),
      "utf8"
    );
    await writeFile(
      chainPath,
      JSON.stringify(runningSnapshot(84532, `0x${"55".repeat(20)}`)),
      "utf8"
    );
    process.env.NEXT_PUBLIC_CHAIN_ID = "84532";
    process.env.KEEPER_HEALTH_PATH = genericPath;
    process.env.KEEPER_HEALTH_PATH_84532 = chainPath;

    const snapshot = await readKeeperHealthSnapshot({ chainId: 84532 });

    expect(snapshot).toMatchObject({
      status: "running",
      chainId: 84532,
      keeper: `0x${"55".repeat(20)}`
    });
  });
});

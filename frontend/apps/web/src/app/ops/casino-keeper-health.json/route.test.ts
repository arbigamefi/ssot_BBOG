import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

const originalEnv = process.env;

describe("GET /ops/casino-keeper-health.json", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_CHAIN_ID: "84532",
      KEEPER_HEALTH_PATH: "/tmp/ssot-missing-casino-keeper-health.json"
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns a stopped health snapshot instead of 404 when the keeper has not published one", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/ops/casino-keeper-health.json"));
    const body = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      schemaVersion: 1,
      status: "stopped",
      chainId: 84532,
      queueDepth: 0
    });
  });

  it("reads the requested chain-specific keeper health file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keeper-health-"));
    const path84532 = join(dir, "base-sepolia-primary-health.json");
    process.env = {
      ...process.env,
      NEXT_PUBLIC_CHAIN_ID: "8453",
      KEEPER_HEALTH_PATH: join(dir, "base-mainnet-primary-health.json"),
      KEEPER_HEALTH_PATH_84532: path84532
    };
    await writeFile(
      path84532,
      JSON.stringify({
        schemaVersion: 1,
        status: "running",
        role: "primary",
        chainId: 84532,
        gameHub: `0x${"11".repeat(20)}`,
        vrfHub: `0x${"22".repeat(20)}`,
        keeper: `0x${"33".repeat(20)}`,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        queueDepth: 0
      }),
      "utf8"
    );

    try {
      const { GET } = await import("./route");
      const response = await GET(
        new Request("http://localhost/ops/casino-keeper-health.json?chainId=84532")
      );
      const body = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        status: "running",
        chainId: 84532,
        keeper: `0x${"33".repeat(20)}`
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

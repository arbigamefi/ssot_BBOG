import { afterAll, beforeEach, describe, expect, it } from "vitest";

const originalEnv = process.env;

describe("GET /ops/casino-keeper-health.json", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      KEEPER_HEALTH_PATH: "/tmp/ssot-missing-casino-keeper-health.json"
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns a stopped health snapshot instead of 404 when the keeper has not published one", async () => {
    const { GET } = await import("./route");

    const response = await GET();
    const body = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      schemaVersion: 1,
      status: "stopped",
      chainId: 84532,
      queueDepth: 0
    });
  });
});

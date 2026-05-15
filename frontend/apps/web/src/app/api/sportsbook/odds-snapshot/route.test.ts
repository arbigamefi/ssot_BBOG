import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sdkMock = vi.hoisted(() => {
  class SignedSportsOddsSnapshotError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(message: string, status = 400, code = "BAD_REQUEST") {
      super(message);
      this.name = "SignedSportsOddsSnapshotError";
      this.status = status;
      this.code = code;
    }
  }

  return {
    createSignedSportsOddsSnapshot: vi.fn(),
    SignedSportsOddsSnapshotError
  };
});

vi.mock("@ssot/ssot/sdk", () => sdkMock);

const originalEnv = process.env;

async function json(response: Response) {
  return (await response.json()) as any;
}

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/sportsbook/odds-snapshot", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("POST /api/sportsbook/odds-snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SPORTSBOOK_ENABLED: "true",
      THE_ODDS_API_KEY: "test-odds-key",
      CANARY_ODDS_SIGNER_PRIVATE_KEY: "11".repeat(32),
      SPORTS_ODDS_SIGNER: "0x1111111111111111111111111111111111111111",
      RPC_URL: "https://base-sepolia.example",
      SPORTS_PROVIDER_SPORT_KEY: "soccer_usa_mls",
      SPORTS_PROVIDER_EVENT_ID: "event-1",
      SPORTS_BOOKMAKER_KEY: "draftkings",
      THE_ODDS_API_REGIONS: "us",
      SPORTS_ODDS_TTL_SECONDS: "90"
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("fails closed when the sportsbook product gate is off", async () => {
    process.env.NEXT_PUBLIC_SPORTSBOOK_ENABLED = "false";
    const { POST } = await import("./route");

    const response = await POST(request({ marketId: "7" }));

    expect(response.status).toBe(403);
    expect(await json(response)).toEqual({
      error: {
        code: "SPORTSBOOK_DISABLED",
        message: "NEXT_PUBLIC_SPORTSBOOK_ENABLED is not true."
      }
    });
    expect(sdkMock.createSignedSportsOddsSnapshot).not.toHaveBeenCalled();
  });

  it("delegates signed odds creation to the SDK with server-only env", async () => {
    sdkMock.createSignedSportsOddsSnapshot.mockResolvedValue({
      schemaVersion: "sportsbook.signed-odds-ticket.v1",
      provider: {
        name: "the-odds-api",
        sportKey: "soccer_usa_mls",
        providerEventId: "event-1"
      },
      market: { marketId: "7", eventId: "97", poolId: 2, marketVersion: "1" },
      outcome: {
        outcomeId: 0,
        side: "home",
        name: "Home FC",
        decimalPrice: "2.1",
        oddsWad: "2100000000000000000"
      },
      stake: "1000000",
      payout: "2100000",
      odds: {
        marketId: "7",
        outcomeId: 0,
        marketVersion: "1",
        oddsWad: "2100000000000000000",
        maxStake: "2000000",
        maxPayout: "4200000",
        expiresAt: "1900000000",
        nonce: "44",
        riskHash: `0x${"07".repeat(32)}`
      },
      oddsTicketHash: `0x${"dd".repeat(32)}`,
      signer: "0x1111111111111111111111111111111111111111",
      signature: `0x${"11".repeat(65)}`
    });
    const { POST } = await import("./route");

    const response = await POST(
      request({
        chainId: 84532,
        marketId: "7",
        outcomeId: 0,
        player: "0x2222222222222222222222222222222222222222",
        stake: "1000000"
      })
    );

    expect(response.status).toBe(200);
    expect((await json(response)).schemaVersion).toBe("sportsbook.signed-odds-ticket.v1");
    expect(sdkMock.createSignedSportsOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        oddsApiKey: "test-odds-key",
        oddsSignerPrivateKey: "11".repeat(32),
        expectedOddsSigner: "0x1111111111111111111111111111111111111111",
        rpcUrl: "https://base-sepolia.example",
        defaultSportKey: "soccer_usa_mls",
        defaultProviderEventId: "event-1",
        defaultBookmakerKey: "draftkings",
        regions: "us",
        ttlSeconds: 90,
        request: expect.objectContaining({ marketId: "7", stake: "1000000" })
      })
    );
  });

  it("preserves SDK typed error status and code", async () => {
    sdkMock.createSignedSportsOddsSnapshot.mockRejectedValue(
      new sdkMock.SignedSportsOddsSnapshotError("Market is not open.", 409, "MARKET_NOT_OPEN")
    );
    const { POST } = await import("./route");

    const response = await POST(request({ marketId: "7", stake: "1000000" }));

    expect(response.status).toBe(409);
    expect(await json(response)).toEqual({
      error: { code: "MARKET_NOT_OPEN", message: "Market is not open." }
    });
  });
});

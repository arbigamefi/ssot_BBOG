import { beforeEach, describe, expect, it, vi } from "vitest";

const queryAffiliateBetsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../../server/betting/recent-bets", async () => {
  const actual = await vi.importActual<typeof import("../../../../../server/betting/recent-bets")>(
    "../../../../../server/betting/recent-bets"
  );
  return {
    ...actual,
    queryAffiliateBets: queryAffiliateBetsMock
  };
});

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

async function json(response: Response) {
  return (await response.json()) as any;
}

describe("GET /api/bets/affiliate/[address]", () => {
  const affiliate = "0x1111111111111111111111111111111111111111";

  beforeEach(() => {
    queryAffiliateBetsMock.mockReset();
    queryAffiliateBetsMock.mockResolvedValue({
      affiliate,
      cached: false,
      chainId: 84532,
      fromBlock: 100,
      generatedAt: 1,
      rows: [],
      schemaVersion: 1,
      source: "postgres",
      stats: {
        affiliate,
        betCount: 0,
        payout: "0",
        payoutGross: "0",
        settledCount: 0,
        turnover: "0"
      },
      toBlock: 200
    });
  });

  it("delegates query params to the affiliate bets service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request(`/api/bets/affiliate/${affiliate}?chainId=84532&limit=7`), {
      params: Promise.resolve({ address: affiliate })
    });

    expect(response.status).toBe(200);
    expect((await json(response)).schemaVersion).toBe(1);
    expect(queryAffiliateBetsMock).toHaveBeenCalledWith({
      affiliate,
      chainId: 84532,
      limit: 7
    });
  });

  it("rejects malformed affiliate addresses before querying", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/bets/affiliate/not-an-address"), {
      params: Promise.resolve({ address: "not-an-address" })
    });

    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("AFFILIATE_BETS_FAILED");
    expect(queryAffiliateBetsMock).not.toHaveBeenCalled();
  });

  it("returns an empty best-effort ledger when aggregation is unavailable", async () => {
    queryAffiliateBetsMock.mockRejectedValueOnce(new Error("database unavailable"));
    const { GET } = await import("./route");
    const response = await GET(request(`/api/bets/affiliate/${affiliate}?chainId=84532&limit=12`), {
      params: Promise.resolve({ address: affiliate })
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      affiliate,
      cached: false,
      chainId: 84532,
      fromBlock: 0,
      rows: [],
      schemaVersion: 1,
      source: "rpc-window",
      stats: {
        affiliate,
        betCount: 0,
        turnover: "0"
      },
      toBlock: 0
    });
  });
});

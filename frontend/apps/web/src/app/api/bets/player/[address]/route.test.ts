import { beforeEach, describe, expect, it, vi } from "vitest";

const queryPlayerBetsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../../server/betting/recent-bets", async () => {
  const actual = await vi.importActual<typeof import("../../../../../server/betting/recent-bets")>(
    "../../../../../server/betting/recent-bets"
  );
  return {
    ...actual,
    queryPlayerBets: queryPlayerBetsMock
  };
});

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

async function json(response: Response) {
  return (await response.json()) as any;
}

describe("GET /api/bets/player/[address]", () => {
  const player = "0x1111111111111111111111111111111111111111";

  beforeEach(() => {
    queryPlayerBetsMock.mockReset();
    queryPlayerBetsMock.mockResolvedValue({
      cached: false,
      chainId: 84532,
      fromBlock: 100,
      generatedAt: 1,
      player,
      rows: [],
      schemaVersion: 1,
      source: "rpc-window",
      toBlock: 200
    });
  });

  it("delegates query params to the player bets service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request(`/api/bets/player/${player}?chainId=84532&limit=7`), {
      params: Promise.resolve({ address: player })
    });

    expect(response.status).toBe(200);
    expect((await json(response)).schemaVersion).toBe(1);
    expect(queryPlayerBetsMock).toHaveBeenCalledWith({
      chainId: 84532,
      limit: 7,
      player
    });
  });

  it("rejects malformed player addresses before querying", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/bets/player/not-an-address"), {
      params: Promise.resolve({ address: "not-an-address" })
    });

    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("PLAYER_BETS_FAILED");
    expect(queryPlayerBetsMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const queryPlayerSportsTicketsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../../../server/sportsbook/player-tickets", () => ({
  queryPlayerSportsTickets: queryPlayerSportsTicketsMock
}));

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

async function json(response: Response) {
  return (await response.json()) as any;
}

describe("GET /api/sportsbook/tickets/player/[address]", () => {
  const player = "0x1111111111111111111111111111111111111111";

  beforeEach(() => {
    queryPlayerSportsTicketsMock.mockReset();
    queryPlayerSportsTicketsMock.mockResolvedValue({
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

  it("delegates query params to the player sports ticket service", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      request(`/api/sportsbook/tickets/player/${player}?chainId=84532&limit=7`),
      {
        params: Promise.resolve({ address: player })
      }
    );

    expect(response.status).toBe(200);
    expect((await json(response)).schemaVersion).toBe(1);
    expect(queryPlayerSportsTicketsMock).toHaveBeenCalledWith({
      chainId: 84532,
      limit: 7,
      player
    });
  });

  it("rejects malformed player addresses before querying", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/sportsbook/tickets/player/not-an-address"), {
      params: Promise.resolve({ address: "not-an-address" })
    });

    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("PLAYER_SPORTS_TICKETS_FAILED");
    expect(queryPlayerSportsTicketsMock).not.toHaveBeenCalled();
  });

  it("returns an empty best-effort ticket ledger when aggregation is unavailable", async () => {
    queryPlayerSportsTicketsMock.mockRejectedValueOnce(new Error("database unavailable"));
    const { GET } = await import("./route");
    const response = await GET(
      request(`/api/sportsbook/tickets/player/${player}?chainId=84532&limit=12`),
      {
        params: Promise.resolve({ address: player })
      }
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      cached: false,
      chainId: 84532,
      fromBlock: 0,
      player,
      rows: [],
      schemaVersion: 1,
      source: "rpc-window",
      toBlock: 0
    });
  });
});

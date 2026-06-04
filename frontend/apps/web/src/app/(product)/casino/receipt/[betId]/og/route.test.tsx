import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryBetReceiptMock, renderOgCardMock } = vi.hoisted(() => ({
  queryBetReceiptMock: vi.fn(),
  renderOgCardMock: vi.fn((args: any) => Response.json(args, { headers: args.headers }))
}));

vi.mock("../../../../../og/render", () => ({
  renderOgCard: renderOgCardMock
}));

vi.mock("../../../../../../server/betting/recent-bets", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../../../server/betting/recent-bets")
  >("../../../../../../server/betting/recent-bets");
  return {
    ...actual,
    queryBetReceipt: queryBetReceiptMock
  };
});

vi.mock("@ssot/ssot/release", async () => {
  const actual = await vi.importActual<typeof import("@ssot/ssot/release")>("@ssot/ssot/release");
  return {
    ...actual,
    loadEmbeddedRelease: vi.fn(() => ({
      ok: true,
      release: {
        assets: [
          {
            address: "0x0000000000000000000000000000000000000001",
            decimals: 6,
            symbol: "USDC"
          }
        ],
        gamesMeta: [
          {
            gameId: "0xgame",
            label: "Dice",
            slug: "dice"
          }
        ]
      }
    }))
  };
});

function request(path: string) {
  return new Request(`https://example.test${path}`);
}

describe("casino receipt OG route", () => {
  beforeEach(() => {
    queryBetReceiptMock.mockReset();
    renderOgCardMock.mockClear();
  });

  it("does not cache a pending indexing card", async () => {
    queryBetReceiptMock.mockResolvedValue({
      betId: "286",
      cached: false,
      chainId: 84532,
      generatedAt: Date.now(),
      row: null,
      schemaVersion: 1,
      source: "postgres"
    });

    const { GET } = await import("./route");
    const response = await GET(request("/casino/receipt/286/og?chainId=84532"), {
      params: Promise.resolve({ betId: "286" })
    });
    const body = await response.json();

    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(body.title).toBe(`Bet ${String.fromCharCode(35)}286`);
    expect(body.stat).toBe("Indexing");
  });

  it("does not cache a terminal receipt image under the stable route", async () => {
    queryBetReceiptMock.mockResolvedValue({
      betId: "286",
      cached: false,
      chainId: 84532,
      generatedAt: Date.now(),
      row: {
        asset: "0x0000000000000000000000000000000000000001",
        betId: "286",
        chainId: 84532,
        gameId: "0xgame",
        lastEventName: "BetFinalized",
        lastTxHash: "0xtx",
        payout: "0",
        refundAmount: "",
        stake: "2500000",
        state: "finalized",
        updatedAt: Date.now()
      },
      schemaVersion: 1,
      source: "postgres"
    });

    const { GET } = await import("./route");
    const response = await GET(request("/casino/receipt/286/og?chainId=84532&v=terminal"), {
      params: Promise.resolve({ betId: "286" })
    });
    const body = await response.json();

    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(body.title).toContain("Settled");
    expect(body.subtitle).toContain("postgres");
  });

  it("renders a terminal share preview without waiting for receipt indexing", async () => {
    queryBetReceiptMock.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET(
      request(
        "/casino/receipt/286/og?chainId=84532&v=settled%3A0xa76261431e46093f8669c400fe6bf0093ff41cf159edaefbed9d5257afca3ded&rt=settled&ra=-1.25%20USDC&rg=dice"
      ),
      {
        params: Promise.resolve({ betId: "286" })
      }
    );
    const body = await response.json();

    expect(queryBetReceiptMock).not.toHaveBeenCalled();
    expect(body.title).toBe("Settled -1.25 USDC");
    expect(body.subtitle).toContain(`Dice bet ${String.fromCharCode(35)}286`);
    expect(body.subtitle).toContain("shared receipt");
  });
});

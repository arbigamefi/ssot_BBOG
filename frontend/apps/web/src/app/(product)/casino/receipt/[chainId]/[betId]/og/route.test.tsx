import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryBetReceiptMock, renderOgCardMock } = vi.hoisted(() => ({
  queryBetReceiptMock: vi.fn(),
  renderOgCardMock: vi.fn((args: any) => Response.json(args, { headers: args.headers }))
}));

vi.mock("../../../../../../og/render", () => ({
  OG_IMMUTABLE_CACHE_HEADERS: {
    "Cache-Control": "public, max-age=31536000, immutable",
    "CDN-Cache-Control": "public, max-age=31536000, immutable",
    "Cloudflare-CDN-Cache-Control": "public, max-age=31536000, immutable"
  },
  OG_NO_STORE_HEADERS: {
    "Cache-Control": "no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store"
  },
  renderOgCard: renderOgCardMock
}));

vi.mock("../../../../../../../server/betting/recent-bets", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../../../../server/betting/recent-bets")
  >("../../../../../../../server/betting/recent-bets");
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

  it("returns a no-store 503 while the receipt is not durable yet", async () => {
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
    const response = await GET(request("/casino/receipt/84532/286/og"), {
      params: Promise.resolve({ betId: "286", chainId: "84532" })
    });
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("5");
    expect(body).toBe("Receipt not ready");
    expect(renderOgCardMock).not.toHaveBeenCalled();
  });

  it("caches a terminal receipt image under the stable route", async () => {
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
    const response = await GET(request("/casino/receipt/84532/286/og"), {
      params: Promise.resolve({ betId: "286", chainId: "84532" })
    });
    const body = await response.json();

    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("cdn-cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(body.title).toContain("Settled");
    expect(body.subtitle).toContain("postgres");
  });
});

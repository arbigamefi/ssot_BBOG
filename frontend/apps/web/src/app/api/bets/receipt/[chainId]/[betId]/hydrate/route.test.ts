import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitBucketsForTests } from "../../../../../../../server/http/rate-limit";

const materializeBetReceiptMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../../../../server/betting/recent-bets", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../../../../server/betting/recent-bets")
  >("../../../../../../../server/betting/recent-bets");
  return {
    ...actual,
    materializeBetReceipt: materializeBetReceiptMock
  };
});

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

async function json(response: Response) {
  return (await response.json()) as any;
}

describe("POST /api/bets/receipt/[chainId]/[betId]/hydrate", () => {
  beforeEach(() => {
    __resetRateLimitBucketsForTests();
    delete process.env.BETS_RECEIPT_HYDRATE_RATE_LIMIT_PER_MINUTE;
    materializeBetReceiptMock.mockReset();
    materializeBetReceiptMock.mockResolvedValue({
      betId: "42",
      cached: false,
      chainId: 84532,
      generatedAt: 1,
      row: { betId: "42" },
      schemaVersion: 1,
      source: "postgres"
    });
  });

  it("verifies and materializes a terminal receipt by transaction hash", async () => {
    const { POST } = await import("./route");
    const terminalTxHash = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const response = await POST(request("/api/bets/receipt/84532/42/hydrate", { terminalTxHash }), {
      params: Promise.resolve({ betId: "42", chainId: "84532" })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await json(response)).row.betId).toBe("42");
    expect(materializeBetReceiptMock).toHaveBeenCalledWith({
      betId: "42",
      chainId: 84532,
      terminalTxHash
    });
  });

  it("rejects malformed transaction hashes", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      request("/api/bets/receipt/84532/42/hydrate", { terminalTxHash: "nope" }),
      {
        params: Promise.resolve({ betId: "42", chainId: "84532" })
      }
    );

    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("BAD_REQUEST");
    expect(materializeBetReceiptMock).not.toHaveBeenCalled();
  });

  it("keeps non-durable materialization pending", async () => {
    materializeBetReceiptMock.mockResolvedValueOnce({
      betId: "42",
      cached: false,
      chainId: 84532,
      generatedAt: 1,
      row: { betId: "42" },
      schemaVersion: 1,
      source: "rpc-window"
    });

    const { POST } = await import("./route");
    const response = await POST(
      request("/api/bets/receipt/84532/42/hydrate", {
        terminalTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      }),
      {
        params: Promise.resolve({ betId: "42", chainId: "84532" })
      }
    );

    expect(response.status).toBe(202);
    expect((await json(response)).source).toBe("rpc-window");
  });
});

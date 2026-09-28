vi.mock("@ssot/ssot/release", async () => {
  const actual = await vi.importActual<typeof import("@ssot/ssot/release")>("@ssot/ssot/release");
  const { createReleaseModuleMock } = await import("../../../../../../test/current-release");
  return { ...actual, ...createReleaseModuleMock() };
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { embeddedChainIds } from "@ssot/ssot/release";
import { __resetRateLimitBucketsForTests } from "../../../../../../server/http/rate-limit";

const queryBetReceiptMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../../../server/betting/recent-bets", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../../../server/betting/recent-bets")
  >("../../../../../../server/betting/recent-bets");
  return {
    ...actual,
    queryBetReceipt: queryBetReceiptMock
  };
});

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

async function json(response: Response) {
  return (await response.json()) as any;
}

describe("GET /api/bets/receipt/[chainId]/[betId]", () => {
  beforeEach(() => {
    __resetRateLimitBucketsForTests();
    delete process.env.BETS_RECEIPT_RATE_LIMIT_PER_MINUTE;
    queryBetReceiptMock.mockReset();
    queryBetReceiptMock.mockResolvedValue({
      betId: "42",
      cached: false,
      chainId: 84532,
      generatedAt: 1,
      row: null,
      schemaVersion: 1,
      source: "postgres"
    });
  });

  it("delegates chain id and bet id to the receipt service", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/bets/receipt/84532/42"), {
      params: Promise.resolve({ betId: "42", chainId: "84532" })
    });

    expect(response.status).toBe(200);
    expect((await json(response)).schemaVersion).toBe(1);
    expect(queryBetReceiptMock).toHaveBeenCalledWith({ betId: "42", chainId: 84532 });
  });

  it("rejects malformed bet ids before querying", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("/api/bets/receipt/84532/nope"), {
      params: Promise.resolve({ betId: "nope", chainId: "84532" })
    });

    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("BET_RECEIPT_FAILED");
    expect(queryBetReceiptMock).not.toHaveBeenCalled();
  });

  it.each(["99999", "31337", "0", "not-a-chain"])(
    "rejects unregistered or invalid chain %s without querying a receipt",
    async (chainId) => {
      const { GET } = await import("./route");
      const response = await GET(request(`/api/bets/receipt/${chainId}/42`), {
        params: Promise.resolve({ betId: "42", chainId })
      });
      expect(response.status).toBe(400);
      expect((await json(response)).error.code).toBe("UNSUPPORTED_CHAIN");
      expect(queryBetReceiptMock).not.toHaveBeenCalled();
    }
  );

  it("does not admit a known network when no release is registered", async () => {
    const previous = [...embeddedChainIds];
    embeddedChainIds.length = 0;
    try {
      const { GET } = await import("./route");
      const response = await GET(request("/api/bets/receipt/84532/42"), {
        params: Promise.resolve({ betId: "42", chainId: "84532" })
      });
      expect(response.status).toBe(400);
      expect((await json(response)).error.code).toBe("UNSUPPORTED_CHAIN");
      expect(queryBetReceiptMock).not.toHaveBeenCalled();
    } finally {
      embeddedChainIds.push(...previous);
    }
  });

  it("rate limits public receipt reads", async () => {
    process.env.BETS_RECEIPT_RATE_LIMIT_PER_MINUTE = "1";
    const { GET } = await import("./route");

    expect(
      (
        await GET(request("/api/bets/receipt/84532/42"), {
          params: Promise.resolve({ betId: "42", chainId: "84532" })
        })
      ).status
    ).toBe(200);
    const response = await GET(request("/api/bets/receipt/84532/42"), {
      params: Promise.resolve({ betId: "42", chainId: "84532" })
    });
    const body = await json(response);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});

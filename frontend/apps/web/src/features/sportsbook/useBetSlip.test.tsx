import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DomainSportsMarket } from "@ssot/ssot";

import { useBetSlip } from "./useBetSlip";

const account = "0x0000000000000000000000000000000000000abc";

const market: DomainSportsMarket = {
  eventId: 44n,
  lockTime: 2_000_000_000,
  marketId: 7n,
  marketKey: "0xabc",
  outcomeCount: 3,
  poolId: 1,
  resultFinalitySeconds: 3600,
  rulebookHash: "0xdef",
  startsAt: 2_000_000_000,
  state: "open",
  version: 1n
};

const release = {
  chainId: 84532,
  pools: [{ poolId: 1, sportsRisk: { riskHash: "0x9999" } }],
  releaseDigest: "0xrelease"
} as any;

function signedOddsResponse() {
  return {
    provider: { bookmakerKey: "book", providerEventId: "event", sportKey: "soccer" },
    outcome: { decimalPrice: "1.95", name: "Home", oddsWad: "1950000000000000000" },
    payout: "3900000",
    odds: {
      expiresAt: "2000000000",
      maxPayout: "1000000000",
      maxStake: "100000000",
      nonce: "1",
      oddsWad: "1950000000000000000",
      riskHash: "0x9999"
    },
    signature: "0xsig"
  };
}

function createSdk(overrides: Partial<any> = {}) {
  return {
    account,
    sportsHub: {
      executeTicketPlan: vi.fn().mockResolvedValue({
        placeTicketTx: { ok: true, txHash: "0xplace" },
        ticketId: 12n
      }),
      planPlaceTicket: vi.fn().mockResolvedValue({
        chainId: 84532,
        payload: {
          marketId: 7n,
          outcomeId: 0,
          poolId: 1,
          signature: "0xsig",
          stake: 2_000_000n
        },
        preview: {},
        releaseDigest: "0xrelease",
        steps: [],
        warnings: []
      }),
      ...overrides
    }
  } as any;
}

describe("useBetSlip", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("places a ticket and returns an immediately useful receipt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => signedOddsResponse() })
    );
    const onPlaced = vi.fn();
    const sdk = createSdk();
    const { result } = renderHook(() =>
      useBetSlip({
        chainId: 84532,
        decimals: 6,
        defaultOutcomeId: 0,
        market,
        onPlaced,
        release,
        sdk,
        walletConnected: true
      })
    );

    act(() => result.current.setStake("2"));
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state).toBe("placed");
    expect(result.current.receipt).toMatchObject({
      eventId: 44n,
      marketId: 7n,
      outcomeId: 0,
      player: account,
      poolId: 1,
      stake: "2000000",
      ticketId: 12n,
      txHash: "0xplace"
    });
    expect(onPlaced).toHaveBeenCalledWith(expect.objectContaining({ ticketId: 12n }));
  });

  it("maps on-chain placement failures to player copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => signedOddsResponse() })
    );
    const sdk = createSdk({
      executeTicketPlan: vi.fn().mockResolvedValue({
        placeTicketTx: {
          error: { message: "execution reverted: OddsExpired(7, 1, 2)" },
          ok: false,
          txHash: "0x0"
        }
      })
    });
    const { result } = renderHook(() =>
      useBetSlip({
        chainId: 84532,
        decimals: 6,
        defaultOutcomeId: 0,
        market,
        release,
        sdk,
        walletConnected: true
      })
    );

    act(() => result.current.setStake("2"));
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe(
      "This price expired. Refresh the market and place the ticket again."
    );
  });
});

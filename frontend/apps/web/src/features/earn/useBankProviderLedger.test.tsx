import * as React from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SSOTSDK } from "@ssot/ssot/sdk";
import { afterEach, expect, it, vi } from "vitest";
import { useBankProviderLedger } from "./useBankProviderLedger";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("excludes cash received after the valuation snapshot and preserves recovery attribution", async () => {
  const account = "0x0000000000000000000000000000000000000001";
  const sdk = {
    account,
    release: { chainId: 84532, releaseDigest: "0xabc", pools: [{ poolId: 1, bank: account }] }
  } as unknown as SSOTSDK;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rows: [
              {
                id: "new",
                action: "recovery",
                assets: "2000000",
                shares: "0",
                epochId: "1",
                blockNumber: 101,
                logIndex: 0,
                txHash: "0xaa"
              },
              {
                id: "old",
                action: "recovery",
                assets: "1000000",
                shares: "0",
                epochId: "1",
                receiver: account,
                caller: account,
                blockNumber: 99,
                logIndex: 0,
                txHash: "0xbb"
              }
            ],
            page: { limit: 25, hasMore: false }
          }),
          { status: 200 }
        )
    )
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useBankProviderLedger({ sdk, poolId: 1, endBlock: 100n }), {
    wrapper
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.entries).toEqual([
    expect.objectContaining({ id: "old", assets: 1_000_000n, epochId: 1n, receiver: account })
  ]);
  expect(result.current.coverageComplete).toBe(false);
  expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("endBlock=100");
});

it.each([
  [{ fromBlock: 0, toBlock: 100, complete: true }, true],
  [{ fromBlock: null, toBlock: 100, complete: false }, false],
  [{ fromBlock: 0, toBlock: 99, complete: true }, false]
])("only accepts complete cash history at the matching block: %j", async (coverage, expected) => {
  const account = "0x0000000000000000000000000000000000000001";
  const sdk = {
    account,
    release: { chainId: 84532, pools: [{ poolId: 1, bank: account }] }
  } as unknown as SSOTSDK;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ rows: [], coverage, page: { limit: 25, hasMore: false } }), {
          status: 200
        })
    )
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useBankProviderLedger({ sdk, poolId: 1, endBlock: 100n }), {
    wrapper
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.coverageComplete).toBe(expected);
});

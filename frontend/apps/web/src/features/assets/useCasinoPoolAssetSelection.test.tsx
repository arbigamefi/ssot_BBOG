import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USDC = "0x3333333333333333333333333333333333333333";
const WETH = "0x6666666666666666666666666666666666666666";

// Mutable mock release so individual tests can vary the pool set / chain.
const state = {
  chainId: 84532,
  release: {
    assets: [
      { symbol: "USDC", address: USDC, decimals: 6 },
      { symbol: "WETH", address: WETH, decimals: 18 }
    ],
    pools: [
      {
        poolId: 1,
        domain: "Casino",
        domainId: 1,
        active: true,
        asset: USDC,
        bank: "0x4444444444444444444444444444444444444444",
        symbol: "USDC",
        decimals: 6
      },
      {
        poolId: 9,
        domain: "Casino",
        domainId: 1,
        active: true,
        asset: WETH,
        bank: "0x7777777777777777777777777777777777777777",
        symbol: "WETH",
        decimals: 18
      }
    ]
  } as Record<string, unknown>
};

vi.mock("../../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ release: state.release, chainId: state.chainId })
}));

import { useCasinoPoolAssetSelection } from "./useCasinoPoolAssetSelection";

const STORAGE_KEY = "arbigamefi.casinoAsset.v1:84532";

describe("useCasinoPoolAssetSelection", () => {
  beforeEach(() => {
    state.chainId = 84532;
    window.localStorage.clear();
  });
  afterEach(() => window.localStorage.clear());

  it("lists casino pool assets and defaults to the first pool", () => {
    const { result } = renderHook(() => useCasinoPoolAssetSelection());
    expect(result.current.assetOptions.map((option) => option.symbol)).toEqual(["USDC", "WETH"]);
    expect(result.current.selectedAsset).toBe(USDC);
    expect(result.current.poolId).toBe(1);
    expect(result.current.decimals).toBe(6);
    expect(result.current.symbol).toBe("USDC");
    expect(result.current.writesSupported).toBe(true);
  });

  it("switches the selected asset, resolves its pool, and persists per-chain", () => {
    const { result } = renderHook(() => useCasinoPoolAssetSelection());
    act(() => result.current.setSelectedAsset(WETH));
    expect(result.current.selectedAsset).toBe(WETH);
    expect(result.current.poolId).toBe(9);
    expect(result.current.decimals).toBe(18);
    expect(result.current.symbol).toBe("WETH");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(WETH);
  });

  it("restores a stored, still-supported choice on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, WETH);
    const { result } = renderHook(() => useCasinoPoolAssetSelection());
    expect(result.current.selectedAsset).toBe(WETH);
    expect(result.current.poolId).toBe(9);
  });

  it("ignores an unsupported selection and ignores unknown stored values", () => {
    window.localStorage.setItem(STORAGE_KEY, "0x9999999999999999999999999999999999999999");
    const { result } = renderHook(() => useCasinoPoolAssetSelection());
    // Stored asset is not an option → falls back to the default pool.
    expect(result.current.selectedAsset).toBe(USDC);
    expect(result.current.poolId).toBe(1);
  });

  it("reports no writes support when the chain has no casino pool", () => {
    state.release = { assets: [], pools: [] };
    const { result } = renderHook(() => useCasinoPoolAssetSelection());
    expect(result.current.assetOptions).toEqual([]);
    expect(result.current.selectedAsset).toBeUndefined();
    expect(result.current.poolId).toBeUndefined();
    expect(result.current.writesSupported).toBe(false);
    // restore the shared fixture for any later test
    state.release = {
      assets: [
        { symbol: "USDC", address: USDC, decimals: 6 },
        { symbol: "WETH", address: WETH, decimals: 18 }
      ],
      pools: [
        {
          poolId: 1,
          domain: "Casino",
          domainId: 1,
          active: true,
          asset: USDC,
          bank: "0x4444444444444444444444444444444444444444",
          symbol: "USDC",
          decimals: 6
        }
      ]
    };
  });
});

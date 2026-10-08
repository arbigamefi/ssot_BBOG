import { describe, expect, it } from "vitest";
import {
  canPoolHoldBet,
  computePoolMaxStakeForReserve,
  computePoolFreeLiquidity,
  deriveGameRoomLimits
} from "./presentation";

const snapshot = { G: 1_000_000_000n, R: 0n, riskReserveBps: 1000 };
const coin = { numerator: 2n, denominator: 1n };
const exact = (stake: bigint, p: bigint, q: bigint, G: bigint, R: bigint, b: number) =>
  G + stake - R - (stake * p) / q >= ((G + stake) * BigInt(b)) / 10000n;

describe("exact room capacity", () => {
  it("uses G including pending principal and subtracts the complete reserve R", () => {
    expect(computePoolFreeLiquidity({ G: 100n, R: 10n, riskReserveBps: 0 })).toBe(90n);
    expect(computePoolFreeLiquidity(undefined)).toBeUndefined();
    expect(computePoolFreeLiquidity({ G: 100n, R: 1000n })).toBe(0n);
  });
  it.each([
    [2n, 1n],
    [100n, 99n],
    [100n, 3n],
    [37n, 18n],
    [37n, 36n],
    [21813n, 10000n]
  ])("finds the exact last base unit for %s/%s, including both Solidity floors", (p, q) => {
    const max = computePoolMaxStakeForReserve({
      snapshot,
      reserveRatio: { numerator: p, denominator: q }
    })!;
    expect(exact(max, p, q, snapshot.G, snapshot.R, 1000)).toBe(true);
    expect(exact(max + 1n, p, q, snapshot.G, snapshot.R, 1000)).toBe(false);
  });
  it("fixes the measured Dice under-99 one-round and 25-round Max rejection", () => {
    const ratio = { numerator: 100n, denominator: 99n };
    expect(computePoolMaxStakeForReserve({ snapshot, reserveRatio: ratio })).toBe(8_174_311_939n);
    for (const count of [1, 25]) {
      const limits = deriveGameRoomLimits({
        poolSnapshot: snapshot,
        reserveRatio: ratio,
        betCount: count,
        assetDecimals: 6,
        assetSymbol: "USDC"
      });
      const total = limits.maxBetRaw! * BigInt(count);
      expect(exact(total, 100n, 99n, snapshot.G, 0n, 1000)).toBe(true);
      expect(exact(total + BigInt(count), 100n, 99n, snapshot.G, 0n, 1000)).toBe(false);
    }
  });
  it("displays the same precise per-round cap the input enforces and its executable total", () => {
    const limits = deriveGameRoomLimits({
      poolSnapshot: snapshot,
      reserveRatio: coin,
      betCount: 25,
      assetDecimals: 6,
      assetSymbol: "USDC"
    });
    expect(limits).toMatchObject({
      maxBetRaw: 32_727_272n,
      maxBet: "32.727272 USDC",
      maxTotal: "818.1818 USDC",
      maxPayout: "1,636.3636 USDC"
    });
  });
  it("uses the on-chain 60% buffer for exact one-round and 25-round limits", () => {
    const current = { ...snapshot, riskReserveBps: 6000 };
    expect(computePoolMaxStakeForReserve({ snapshot: current, reserveRatio: coin })).toBe(
      250_000_000n
    );
    const limits = deriveGameRoomLimits({
      poolSnapshot: current,
      reserveRatio: coin,
      betCount: 25,
      assetDecimals: 6,
      assetSymbol: "USDC"
    });
    expect(limits).toMatchObject({
      maxBetRaw: 10_000_000n,
      maxBet: "10 USDC",
      maxTotal: "250 USDC"
    });
    expect(exact(250_000_000n, 2n, 1n, current.G, 0n, 6000)).toBe(true);
    expect(exact(250_000_025n, 2n, 1n, current.G, 0n, 6000)).toBe(false);
  });
  it("caps at numerical tree headroom even when the reserve inequality allows more", () => {
    const M = (1n << 108n) - 1n;
    const current = { G: M - 10n, R: 0n, riskReserveBps: 0 };
    expect(computePoolMaxStakeForReserve({ snapshot: current, reserveRatio: coin })).toBe(10n);
    expect(canPoolHoldBet({ snapshot: current, stake: 11n, requiredReserve: 22n })).toBe(false);
  });
  it("shrinks the limit immediately in a snapshot after a successful NFT withdrawal", () => {
    const before = computePoolMaxStakeForReserve({ snapshot, reserveRatio: coin })!;
    const after = computePoolMaxStakeForReserve({
      snapshot: { ...snapshot, G: snapshot.G - 950_000_000n },
      reserveRatio: coin
    })!;
    expect(after).toBeLessThan(before);
    expect(after).toBe(40_909_091n);
  });
  it("does not guess odds or liquidity when the required inputs are absent", () => {
    expect(computePoolMaxStakeForReserve({ snapshot, reserveRatio: undefined })).toBeUndefined();
    expect(
      deriveGameRoomLimits({
        poolSnapshot: snapshot,
        reserveRatio: undefined,
        betCount: 1,
        assetDecimals: 6,
        assetSymbol: "USDC"
      })
    ).toMatchObject({ maxBet: "—", maxBetState: "pending-selection" });
    expect(
      deriveGameRoomLimits({
        poolSnapshot: undefined,
        reserveRatio: coin,
        betCount: 1,
        assetDecimals: 6,
        assetSymbol: "USDC"
      })
    ).toMatchObject({ maxBet: "—", maxBetState: "pending-liquidity" });
  });
  it("matches an independent exhaustive enumeration on small balances and fractional odds", () => {
    for (const G of [1n, 7n, 31n])
      for (const R of [0n, G / 2n, G])
        for (const b of [0, 1000, 6000, 10000])
          for (const [p, q] of [
            [2n, 1n],
            [37n, 18n],
            [100n, 99n]
          ]) {
            let brute = 0n;
            for (let amount = 1n; amount <= G * 100n + 100n; amount++)
              if (exact(amount, p!, q!, G, R, b)) brute = amount;
            expect(
              computePoolMaxStakeForReserve({
                snapshot: { G, R, riskReserveBps: b },
                reserveRatio: { numerator: p!, denominator: q! }
              })
            ).toBe(brute);
          }
  });
});

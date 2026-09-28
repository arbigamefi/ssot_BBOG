import { beforeEach, describe, expect, it, vi } from "vitest";

const { embeddedChainIds } = vi.hoisted(() => ({ embeddedChainIds: [] as number[] }));
vi.mock("@ssot/ssot/release", () => ({ embeddedChainIds }));

import {
  getExplorerAddressUrl,
  getExplorerTxUrl,
  getSupportedAppChains,
  isSupportedAppChain,
  resolveDefaultAppChainId
} from "./chain-registry";

describe("chain registry", () => {
  beforeEach(() => {
    embeddedChainIds.splice(0, embeddedChainIds.length, 8453, 84532);
  });

  it("exposes embedded mainnet and testnet releases as selectable chains", () => {
    const chains = getSupportedAppChains();

    expect(chains.map((chain) => chain.id)).toContain(8453);
    expect(chains.map((chain) => chain.id)).toContain(84532);
    expect(chains[0]?.environment).toBe("mainnet");
  });

  it("resolves a configured default chain only when it is embedded", () => {
    expect(resolveDefaultAppChainId("84532")).toBe(84532);
    expect(resolveDefaultAppChainId("99999")).toBe(8453);
  });

  it("keeps the wallet shell usable without exposing an undeployed selectable chain", () => {
    embeddedChainIds.length = 0;
    expect(getSupportedAppChains()).toEqual([]);
    expect(isSupportedAppChain(8453)).toBe(false);
    expect(isSupportedAppChain(84532)).toBe(false);
    // A provider needs a chain context; it is not an admitted deployment.
    expect(resolveDefaultAppChainId("8453")).toBe(84532);
  });

  it("admits only the configured first deployment", () => {
    embeddedChainIds.splice(0, embeddedChainIds.length, 84532);
    expect(getSupportedAppChains().map((chain) => chain.id)).toEqual([84532]);
    expect(isSupportedAppChain(8453)).toBe(false);
    expect(resolveDefaultAppChainId("8453")).toBe(84532);
  });

  it("builds explorer URLs per chain and returns null when inputs are missing", () => {
    expect(getExplorerTxUrl(8453, "0xabc")).toBe("https://basescan.org/tx/0xabc");
    expect(getExplorerTxUrl(84532, "0xdef")).toBe("https://sepolia.basescan.org/tx/0xdef");
    expect(getExplorerTxUrl(42161, "0xarb")).toBe("https://arbiscan.io/tx/0xarb");
    expect(getExplorerTxUrl(421614, "0xarbsep")).toBe("https://sepolia.arbiscan.io/tx/0xarbsep");
    expect(getExplorerTxUrl(8453, "")).toBeNull();
    expect(getExplorerTxUrl(undefined, "0xabc")).toBeNull();
    expect(getExplorerTxUrl(999, "0xabc")).toBeNull(); // unknown chain

    expect(getExplorerAddressUrl(8453, "0x1234")).toBe("https://basescan.org/address/0x1234");
    expect(getExplorerAddressUrl(42161, "0x1234")).toBe("https://arbiscan.io/address/0x1234");
    expect(getExplorerAddressUrl(undefined, "0x1234")).toBeNull();
  });
});

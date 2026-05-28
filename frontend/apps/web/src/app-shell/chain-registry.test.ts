import { describe, expect, it } from "vitest";

import {
  getExplorerAddressUrl,
  getExplorerTxUrl,
  getSupportedAppChains,
  resolveDefaultAppChainId
} from "./chain-registry";

describe("chain registry", () => {
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

  it("builds explorer URLs per chain and returns null when inputs are missing", () => {
    expect(getExplorerTxUrl(8453, "0xabc")).toBe("https://basescan.org/tx/0xabc");
    expect(getExplorerTxUrl(84532, "0xdef")).toBe("https://sepolia.basescan.org/tx/0xdef");
    expect(getExplorerTxUrl(8453, "")).toBeNull();
    expect(getExplorerTxUrl(undefined, "0xabc")).toBeNull();
    expect(getExplorerTxUrl(999, "0xabc")).toBeNull(); // unknown chain

    expect(getExplorerAddressUrl(8453, "0x1234")).toBe("https://basescan.org/address/0x1234");
    expect(getExplorerAddressUrl(undefined, "0x1234")).toBeNull();
  });
});

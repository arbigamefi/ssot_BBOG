import { describe, expect, it } from "vitest";

import { getSupportedAppChains, resolveDefaultAppChainId } from "./chain-registry";

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
});

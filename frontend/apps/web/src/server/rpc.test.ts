import { describe, expect, it } from "vitest";

import { resolveServerRpcUrl } from "./rpc";

describe("server RPC resolution", () => {
  it("uses Base mainnet scoped RPC before the generic RPC_URL", () => {
    expect(
      resolveServerRpcUrl(8453, {
        BASE_MAINNET_RPC_URL: "https://base-mainnet.example",
        RPC_URL: "https://generic.example"
      })
    ).toBe("https://base-mainnet.example");
  });

  it("uses Base Sepolia scoped RPC before the generic RPC_URL", () => {
    expect(
      resolveServerRpcUrl(84532, {
        BASE_SEPOLIA_RPC_URL: "https://base-sepolia.example",
        RPC_URL: "https://generic.example"
      })
    ).toBe("https://base-sepolia.example");
  });

  it("does not let Base Sepolia RPC hijack Base mainnet", () => {
    expect(
      resolveServerRpcUrl(8453, {
        BASE_SEPOLIA_RPC_URL: "https://base-sepolia.example",
        NEXT_PUBLIC_ALCHEMY_API_KEY: "alchemy-key"
      })
    ).toBe("https://base-mainnet.g.alchemy.com/v2/alchemy-key");
  });

  it("ignores generic RPC_URL unless explicitly allowed", () => {
    expect(resolveServerRpcUrl(8453, { RPC_URL: "https://generic.example" })).toBeUndefined();
    expect(
      resolveServerRpcUrl(
        8453,
        { RPC_URL: "https://generic.example" },
        { allowGenericFallback: true }
      )
    ).toBe("https://generic.example");
  });

  it("resolves Arbitrum scoped RPC URLs", () => {
    expect(
      resolveServerRpcUrl(42161, {
        ARBITRUM_RPC_URL: "https://arbitrum.example",
        RPC_URL: "https://generic.example"
      })
    ).toBe("https://arbitrum.example");
    expect(
      resolveServerRpcUrl(421614, {
        ARBITRUM_SEPOLIA_RPC_URL: "https://arbitrum-sepolia.example"
      })
    ).toBe("https://arbitrum-sepolia.example");
  });
});

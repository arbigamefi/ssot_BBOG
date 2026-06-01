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
});

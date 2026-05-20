import { describe, expect, it } from "vitest";
import { baseSepolia } from "wagmi/chains";

import { resolvePublicRpcUrl, withConfiguredRpc } from "./rpc";

describe("public RPC configuration", () => {
  it("uses a chain-specific public RPC URL before generic fallbacks", () => {
    expect(
      resolvePublicRpcUrl(84532, {
        NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: "https://base-sepolia.example",
        NEXT_PUBLIC_RPC_URL: "https://generic.example",
        NEXT_PUBLIC_ALCHEMY_API_KEY: "alchemy-key"
      })
    ).toBe("https://base-sepolia.example");
  });

  it("derives the Base Sepolia Alchemy URL from the public Alchemy key", () => {
    expect(
      resolvePublicRpcUrl(84532, {
        NEXT_PUBLIC_ALCHEMY_API_KEY: "alchemy-key"
      })
    ).toBe("https://base-sepolia.g.alchemy.com/v2/alchemy-key");
  });

  it("does not read the server-only RPC_URL value", () => {
    expect(
      resolvePublicRpcUrl(84532, {
        RPC_URL: "https://server-only.example",
        NEXT_PUBLIC_ALCHEMY_API_KEY: "alchemy-key"
      } as any)
    ).toBe("https://base-sepolia.g.alchemy.com/v2/alchemy-key");
  });

  it("patches wagmi chain rpcUrls when a public RPC is configured", () => {
    const chain = withConfiguredRpc(baseSepolia, {
      NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: "https://base-sepolia.example"
    });

    expect(chain.rpcUrls.default.http[0]).toBe("https://base-sepolia.example");
    expect((chain.rpcUrls as any).public.http[0]).toBe("https://base-sepolia.example");
  });
});

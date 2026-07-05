import { describe, expect, it } from "vitest";
import { baseSepolia } from "wagmi/chains";

import { resolvePublicRpcUrl, resolvePublicWsRpcUrl, withConfiguredRpc } from "./rpc";

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

  it("prefers the per-network Alchemy URL over a generic shared URL", () => {
    // Even when both are set, the per-network Alchemy endpoint must win so
    // multi-chain reads never get routed to the wrong network.
    expect(
      resolvePublicRpcUrl(
        8453,
        {
          NEXT_PUBLIC_RPC_URL: "https://generic.example",
          NEXT_PUBLIC_ALCHEMY_API_KEY: "alchemy-key"
        },
        { allowGenericFallback: true }
      )
    ).toBe("https://base-mainnet.g.alchemy.com/v2/alchemy-key");
  });

  it("ignores the generic shared URL in multi-chain mode (footgun closed)", () => {
    // Without allowGenericFallback, a lone generic URL must NOT back a chain —
    // a single URL can't serve multiple networks.
    expect(
      resolvePublicRpcUrl(8453, { NEXT_PUBLIC_RPC_URL: "https://generic.example" })
    ).toBeUndefined();
  });

  it("uses the generic shared URL only when explicitly allowed (single chain)", () => {
    expect(
      resolvePublicRpcUrl(
        8453,
        { NEXT_PUBLIC_RPC_URL: "https://generic.example" },
        { allowGenericFallback: true }
      )
    ).toBe("https://generic.example");
  });

  it("patches wagmi chain rpcUrls when a public RPC is configured", () => {
    const chain = withConfiguredRpc(baseSepolia, {
      NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: "https://base-sepolia.example"
    });

    expect(chain.rpcUrls.default.http[0]).toBe("https://base-sepolia.example");
    expect((chain.rpcUrls as any).public.http[0]).toBe("https://base-sepolia.example");
  });

  it("uses a chain-specific public websocket RPC URL before derived Alchemy fallbacks", () => {
    expect(
      resolvePublicWsRpcUrl(84532, {
        NEXT_PUBLIC_BASE_SEPOLIA_WS_RPC_URL: "wss://base-sepolia-ws.example",
        NEXT_PUBLIC_ALCHEMY_API_KEY: "alchemy-key"
      })
    ).toBe("wss://base-sepolia-ws.example");
  });

  it("derives the Base Sepolia Alchemy websocket URL from the public Alchemy key", () => {
    expect(
      resolvePublicWsRpcUrl(84532, {
        NEXT_PUBLIC_ALCHEMY_API_KEY: "alchemy-key"
      })
    ).toBe("wss://base-sepolia.g.alchemy.com/v2/alchemy-key");
  });

  it("does not derive websockets from non-Alchemy HTTP RPC URLs", () => {
    expect(
      resolvePublicWsRpcUrl(84532, {
        NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: "https://base-sepolia.example"
      })
    ).toBeUndefined();
  });
});

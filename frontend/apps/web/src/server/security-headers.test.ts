import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "./security-headers.mjs";

describe("security headers", () => {
  it("allows the mobile MetaMask pairing endpoint without opening arbitrary connections", () => {
    const csp = buildContentSecurityPolicy({ env: { NODE_ENV: "production" }, isDev: false });
    const connect = csp
      .split("; ")
      .find((directive: string) => directive.startsWith("connect-src "));
    const sources = connect?.split(" ");

    expect(sources).toContain("https://metamask-sdk.api.cx.metamask.io");
    expect(sources).toContain("wss://metamask-sdk.api.cx.metamask.io");
    expect(sources).toContain("wss://*.walletconnect.com");
    expect(sources).not.toContain("*");
    expect(sources).not.toContain("https:");
    expect(sources).not.toContain("wss:");
  });

  it("keeps Figma bridge and unsafe eval out of production CSP", () => {
    const csp = buildContentSecurityPolicy({
      env: {
        NEXT_PUBLIC_BASE_RPC_URL: "https://example-rpc.invalid/path",
        NEXT_PUBLIC_BASE_WS_RPC_URL: "wss://example-ws.invalid/path"
      } as unknown as NodeJS.ProcessEnv,
      isDev: false
    });

    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("mcp.figma.com");
    expect(csp).toContain("https://example-rpc.invalid");
    expect(csp).toContain("wss://example-ws.invalid");
    expect(csp).toContain("https://api.web3modal.org");
    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com"
    );
    expect(csp).toContain("https://cloudflareinsights.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("does not allow Alchemy when the build uses public RPCs", () => {
    const csp = buildContentSecurityPolicy({
      env: {
        NEXT_PUBLIC_ALCHEMY_API_KEY: "",
        NEXT_PUBLIC_BASE_RPC_URL: "https://mainnet.base.org",
        NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL: "https://sepolia.base.org",
        NEXT_PUBLIC_MAINNET_RPC_URL: "https://cloudflare-eth.com"
      } as unknown as NodeJS.ProcessEnv,
      isDev: false
    });
    const sources = connectSources(csp);

    expect(csp).not.toContain("alchemy");
    expect(sources).toContain("https://mainnet.base.org");
    expect(sources).toContain("https://sepolia.base.org");
    expect(sources.filter((source) => source === "https://mainnet.base.org")).toHaveLength(1);
  });

  it("allows every Alchemy network the app can derive from an Alchemy key", () => {
    const csp = buildContentSecurityPolicy({
      env: { NEXT_PUBLIC_ALCHEMY_API_KEY: "key" } as unknown as NodeJS.ProcessEnv,
      isDev: false
    });
    const sources = connectSources(csp);

    for (const network of [
      "base-mainnet",
      "base-sepolia",
      "arb-mainnet",
      "arb-sepolia",
      "eth-mainnet"
    ]) {
      expect(sources).toContain(`https://${network}.g.alchemy.com`);
      expect(sources).toContain(`wss://${network}.g.alchemy.com`);
    }
  });

  it("allows the WebSocket origin the app derives from a configured Alchemy URL", () => {
    const csp = buildContentSecurityPolicy({
      env: {
        NEXT_PUBLIC_BASE_RPC_URL: "https://base-mainnet.g.alchemy.com/v2/key"
      } as unknown as NodeJS.ProcessEnv,
      isDev: false
    });
    const sources = connectSources(csp);

    expect(sources).toContain("https://base-mainnet.g.alchemy.com");
    expect(sources).toContain("wss://base-mainnet.g.alchemy.com");
    expect(sources).not.toContain("https://base-sepolia.g.alchemy.com");
  });

  it("allows the Figma capture bridge only in development", () => {
    const csp = buildContentSecurityPolicy({ isDev: true });

    expect(csp).toContain("unsafe-eval");
    expect(csp).toContain("https://mcp.figma.com");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

function connectSources(csp: string) {
  return (
    csp
      .split("; ")
      .find((directive: string) => directive.startsWith("connect-src "))
      ?.split(" ") ?? []
  );
}

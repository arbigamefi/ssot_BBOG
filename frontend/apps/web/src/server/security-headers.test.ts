import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "./security-headers.mjs";

describe("security headers", () => {
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
    expect(csp).toContain("wss://base-mainnet.g.alchemy.com");
    expect(csp).toContain("wss://base-sepolia.g.alchemy.com");
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

  it("allows the Figma capture bridge only in development", () => {
    const csp = buildContentSecurityPolicy({ isDev: true });

    expect(csp).toContain("unsafe-eval");
    expect(csp).toContain("https://mcp.figma.com");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

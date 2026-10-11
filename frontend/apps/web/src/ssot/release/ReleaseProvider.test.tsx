vi.mock("@ssot/ssot/release", async () => {
  const actual = await vi.importActual<typeof import("@ssot/ssot/release")>("@ssot/ssot/release");
  const { createReleaseModuleMock } = await import("../../test/current-release");
  return { ...actual, ...createReleaseModuleMock() };
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

import { ReleaseProvider, useRelease } from "./ReleaseProvider";

function ReleaseProbe() {
  const release = useRelease();
  return (
    <div>
      <span data-testid="chain-id">{release.chainId}</span>
      <span data-testid="read-only">{String(release.readOnly)}</span>
      <span data-testid="release-read-only">{String(release.releaseReadOnly)}</span>
      <span data-testid="wallet-mismatch">{String(release.walletChainMismatch)}</span>
      <span data-testid="reason">{release.readOnlyReason ?? ""}</span>
    </div>
  );
}

describe("ReleaseProvider", () => {
  afterEach(cleanup);

  it("keeps an unregistered chain read-only without claiming a deployment exists", () => {
    render(
      <ReleaseProvider chainId={99999}>
        <ReleaseProbe />
      </ReleaseProvider>
    );
    expect(screen.getByTestId("read-only").textContent).toBe("true");
    expect(screen.getByTestId("release-read-only").textContent).toBe("true");
    expect(screen.getByTestId("reason").textContent).toContain(
      "No embedded release for chainId=99999"
    );
  });

  it("keeps reads available while blocking writes on wallet chain mismatch", () => {
    render(
      <ReleaseProvider chainId={84532} selectedChainName="Base Sepolia" walletChainId={8453}>
        <ReleaseProbe />
      </ReleaseProvider>
    );

    expect(screen.getByTestId("chain-id").textContent).toBe("84532");
    expect(screen.getByTestId("read-only").textContent).toBe("true");
    expect(screen.getByTestId("release-read-only").textContent).toBe("false");
    expect(screen.getByTestId("wallet-mismatch").textContent).toBe("true");
    expect(screen.getByTestId("reason").textContent).toContain("Base Sepolia");
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search)
}));

import { ActiveChainProvider, useActiveChain } from "./ActiveChainProvider";

function Probe() {
  const { selectedChainId, setSelectedChainId, supportedChains } = useActiveChain();
  return (
    <div>
      <p data-testid="selected-chain">{selectedChainId}</p>
      {supportedChains.map((chain) => (
        <button key={chain.id} type="button" onClick={() => setSelectedChainId(chain.id)}>
          {chain.name}
        </button>
      ))}
    </div>
  );
}

describe("ActiveChainProvider", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("uses the configured initial chain when it is supported", () => {
    render(
      <ActiveChainProvider initialChainId="84532">
        <Probe />
      </ActiveChainProvider>
    );

    expect(screen.getByTestId("selected-chain").textContent).toBe("84532");
  });

  it("persists the selected chain for later sessions", () => {
    const { unmount } = render(
      <ActiveChainProvider initialChainId="8453">
        <Probe />
      </ActiveChainProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Base Sepolia" }));
    expect(screen.getByTestId("selected-chain").textContent).toBe("84532");

    unmount();

    render(
      <ActiveChainProvider initialChainId="8453">
        <Probe />
      </ActiveChainProvider>
    );

    expect(screen.getByTestId("selected-chain").textContent).toBe("84532");
  });

  it("uses a supported chainId from the URL over stored state", async () => {
    window.localStorage.setItem("arbigamefi.activeChainId.v1", "8453");
    window.history.replaceState(null, "", "/casino?chainId=84532");

    render(
      <ActiveChainProvider initialChainId="8453">
        <Probe />
      </ActiveChainProvider>
    );

    await waitFor(() => expect(screen.getByTestId("selected-chain").textContent).toBe("84532"));
    expect(window.localStorage.getItem("arbigamefi.activeChainId.v1")).toBe("84532");
  });

  it("ignores an unsupported chainId from the URL", async () => {
    window.localStorage.setItem("arbigamefi.activeChainId.v1", "84532");
    window.history.replaceState(null, "", "/casino?chainId=999999");

    render(
      <ActiveChainProvider initialChainId="8453">
        <Probe />
      </ActiveChainProvider>
    );

    await waitFor(() => expect(screen.getByTestId("selected-chain").textContent).toBe("84532"));
  });
  it("uses the public receipt path chain over stored state and conflicting query", async () => {
    window.localStorage.setItem("arbigamefi.activeChainId.v1", "8453");
    window.history.replaceState(null, "", "/casino/receipt/84532/9?chainId=8453");
    render(
      <ActiveChainProvider initialChainId="8453">
        <Probe />
      </ActiveChainProvider>
    );
    await waitFor(() => expect(screen.getByTestId("selected-chain").textContent).toBe("84532"));
  });

  it("follows client route changes and browser back navigation", async () => {
    const content = (
      <ActiveChainProvider initialChainId="8453">
        <Probe />
      </ActiveChainProvider>
    );
    const { rerender } = render(content);
    window.history.pushState(null, "", "/casino/receipt/84532/9");
    rerender(
      <ActiveChainProvider initialChainId="8453">
        <Probe />
      </ActiveChainProvider>
    );
    await waitFor(() => expect(screen.getByTestId("selected-chain").textContent).toBe("84532"));
    window.history.replaceState(null, "", "/casino/dice?chainId=8453");
    fireEvent.popState(window);
    await waitFor(() => expect(screen.getByTestId("selected-chain").textContent).toBe("8453"));
  });
});

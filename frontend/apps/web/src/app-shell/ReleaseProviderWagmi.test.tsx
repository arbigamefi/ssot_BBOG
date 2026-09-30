import * as React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReleaseProviderWagmi } from "./ReleaseProviderWagmi";
const account = vi.hoisted(() => ({ isConnected: true, chainId: 8453 }));
vi.mock("wagmi", () => ({ useChainId: () => 84532, useAccount: () => account }));
vi.mock("./ActiveChainProvider", () => ({
  useActiveChain: () => ({ selectedChainId: 84532, selectedChain: { name: "Base Sepolia" } })
}));
vi.mock("../ssot/release/ReleaseProvider", () => ({
  ReleaseProvider: ({ walletChainId }: { walletChainId?: number }) => (
    <output>{walletChainId ?? "anonymous"}</output>
  )
}));
afterEach(cleanup);
it("passes the actual unsupported wallet network instead of Wagmi's configured fallback", () => {
  const view = render(
    <ReleaseProviderWagmi>
      <span />
    </ReleaseProviderWagmi>
  );
  expect(screen.getByRole("status")).toHaveTextContent("8453");
  account.isConnected = false;
  view.rerender(
    <ReleaseProviderWagmi>
      <span />
    </ReleaseProviderWagmi>
  );
  expect(screen.getByRole("status")).toHaveTextContent("anonymous");
});

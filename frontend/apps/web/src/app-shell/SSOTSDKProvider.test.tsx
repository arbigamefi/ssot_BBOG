import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SSOTSDKProvider } from "./SSOTSDKProvider";
import { useSSOTSDK } from "../ssot/sdk";

const state = vi.hoisted(() => ({
  address: undefined as string | undefined,
  wallet: undefined as { account: { address: string }; chain: { id: number } } | undefined,
  chainId: 84532,
  readOnly: false,
  release: { chainId: 84532 },
  publicClient: {},
  journal: {}
}));
vi.mock("wagmi", () => ({
  // Wagmi keeps this configured chain when the wallet switches to an unsupported network.
  useChainId: () => 84532,
  useAccount: () => ({ address: state.address, chainId: state.chainId }),
  usePublicClient: () => state.publicClient,
  useWalletClient: () => ({ data: state.wallet })
}));
vi.mock("../ssot/release/ReleaseProvider", () => ({
  useRelease: () => ({ release: state.release, readOnly: state.readOnly })
}));
vi.mock("../ssot/runtime", () => ({ useSSOTRuntime: () => ({ journal: state.journal }) }));
vi.mock("@ssot/ssot/sdk", () => ({ createSSOTSDK: (params: unknown) => params }));
afterEach(cleanup);
beforeEach(() => {
  state.address = undefined;
  state.wallet = undefined;
  state.chainId = 84532;
  state.readOnly = false;
});

it("keeps anonymous reads ready but waits for the signing client during wallet reconnection", () => {
  function Consumer() {
    const { ready } = useSSOTSDK();
    return <button disabled={!ready}>Wallet action</button>;
  }
  const ui = () => (
    <SSOTSDKProvider>
      <Consumer />
    </SSOTSDKProvider>
  );
  const view = render(ui());
  expect(screen.getByRole("button")).not.toBeDisabled();
  state.address = "0x0000000000000000000000000000000000000001";
  view.rerender(ui());
  expect(screen.getByRole("button")).toBeDisabled();
  state.wallet = { account: { address: state.address }, chain: { id: 84532 } };
  view.rerender(ui());
  expect(screen.getByRole("button")).not.toBeDisabled();
  state.wallet = undefined;
  view.rerender(ui());
  expect(screen.getByRole("button")).toBeDisabled();
  state.address = undefined;
  view.rerender(ui());
  expect(screen.getByRole("button")).not.toBeDisabled();
});

it("waits for the signing client to match the connected account and release network", () => {
  state.address = "0x0000000000000000000000000000000000000001";
  state.wallet = { account: { address: state.address }, chain: { id: 84532 } };
  function Consumer() {
    return <button disabled={!useSSOTSDK().ready}>Wallet action</button>;
  }
  const ui = () => (
    <SSOTSDKProvider>
      <Consumer />
    </SSOTSDKProvider>
  );
  const view = render(ui());
  expect(screen.getByRole("button")).not.toBeDisabled();
  state.address = "0x0000000000000000000000000000000000000002";
  view.rerender(ui());
  expect(screen.getByRole("button")).toBeDisabled();
  state.wallet = { account: { address: state.address }, chain: { id: 84532 } };
  view.rerender(ui());
  expect(screen.getByRole("button")).not.toBeDisabled();
  state.chainId = 8453;
  view.rerender(ui());
  expect(screen.getByRole("button")).toBeDisabled();
});

it("revokes a captured signing context after switch-away and switch-back, and on unmount", () => {
  state.address = "0x0000000000000000000000000000000000000001";
  state.wallet = { account: { address: state.address }, chain: { id: 84532 } };
  let current: { assertWalletContext: () => void };
  function Consumer() {
    current = useSSOTSDK().sdk as unknown as typeof current;
    return null;
  }
  const ui = () => (
    <SSOTSDKProvider>
      <Consumer />
    </SSOTSDKProvider>
  );
  const view = render(ui());
  const original = current!;
  expect(() => original.assertWalletContext()).not.toThrow();
  state.chainId = 8453;
  view.rerender(ui());
  state.chainId = 84532;
  view.rerender(ui());
  expect(() => original.assertWalletContext()).toThrow();
  expect(() => current!.assertWalletContext()).not.toThrow();
  view.unmount();
  expect(() => current!.assertWalletContext()).toThrow();
});

it.each(["account", "disconnect", "chain", "release", "readOnly", "client"] as const)(
  "revokes the previous SDK when %s changes",
  (change) => {
    state.address = "0x0000000000000000000000000000000000000001";
    state.wallet = { account: { address: state.address }, chain: { id: 84532 } };
    let current: { assertWalletContext: () => void };
    function Consumer() {
      current = useSSOTSDK().sdk as unknown as typeof current;
      return null;
    }
    const ui = () => (
      <SSOTSDKProvider>
        <Consumer />
      </SSOTSDKProvider>
    );
    const view = render(ui());
    const previous = current!;
    if (change === "account") state.address = "0x0000000000000000000000000000000000000002";
    if (change === "disconnect") state.address = undefined;
    if (change === "chain") state.chainId = 8453;
    if (change === "release") state.release = { chainId: 84532 };
    if (change === "readOnly") state.readOnly = true;
    if (change === "client") state.wallet = { ...state.wallet };
    view.rerender(ui());
    expect(() => previous.assertWalletContext()).toThrow();
  }
);

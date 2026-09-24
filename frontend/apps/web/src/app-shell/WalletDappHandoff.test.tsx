// @vitest-environment-options {"url":"https://arbigamefi.com/casino/dice?ref=a%2Bb#rules"}
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletDappHandoff } from "./WalletDappHandoff";
import * as links from "./wallet-dapp-links";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("./ActiveChainProvider", () => ({ useActiveChain: () => ({ selectedChainId: 84532 }) }));

const originalConnect = vi.fn();
function View({ id = "metaMask", scoped = true }: { id?: string; scoped?: boolean }) {
  return (
    <div role="dialog" aria-labelledby={scoped ? "rk_connect_title" : "another-modal"}>
      <button data-testid={`rk-wallet-option-${id}`} onClick={originalConnect}>
        <span>{id}</span>
      </button>
      <WalletDappHandoff />
    </div>
  );
}
beforeEach(() => {
  vi.stubGlobal("navigator", { userAgent: "iPhone Mobile Safari", maxTouchPoints: 1 });
  vi.stubGlobal("ethereum", undefined);
  vi.spyOn(links, "openWalletDapp").mockImplementation(() => {});
  originalConnect.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("existing wallet selector handoff", () => {
  it.each(["metaMask", "trust", "rainbow", "okx", "coinbase"])(
    "opens %s on the original click without starting pairing",
    (id) => {
      render(<View id={id} />);
      fireEvent.click(screen.getByText(id));
      expect(links.openWalletDapp).toHaveBeenCalledOnce();
      expect(originalConnect).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toHaveTextContent("notOpened");
      expect(screen.getByRole("link", { name: "retryOpen" })).toHaveAttribute(
        "href",
        vi.mocked(links.openWalletDapp).mock.calls[0]![0]
      );
      expect(screen.getByRole("link", { name: "downloadWallet" })).toBeVisible();
    }
  );
  it.each(["walletConnect", "unknown"])("leaves %s to its official connector", (id) => {
    render(<View id={id} />);
    fireEvent.click(screen.getByText(id));
    expect(originalConnect).toHaveBeenCalledOnce();
    expect(links.openWalletDapp).not.toHaveBeenCalled();
  });
  it("does not intercept another dialog with a matching button ID", () => {
    render(<View scoped={false} />);
    fireEvent.click(screen.getByText("metaMask"));
    expect(originalConnect).toHaveBeenCalledOnce();
    expect(links.openWalletDapp).not.toHaveBeenCalled();
  });
  it("leaves injected and late-announced providers in the current browser", () => {
    const view = render(<View />);
    act(() => window.dispatchEvent(new Event("eip6963:announceProvider")));
    fireEvent.click(screen.getByText("metaMask"));
    expect(links.openWalletDapp).not.toHaveBeenCalled();
    expect(screen.queryByTestId("wallet-dapp-handoff")).not.toBeInTheDocument();
    view.unmount();
    vi.stubGlobal("ethereum", { request: vi.fn() });
    render(<View />);
    fireEvent.click(screen.getByText("metaMask"));
    expect(links.openWalletDapp).not.toHaveBeenCalled();
  });
  it("does not intercept desktop clicks or modified mobile clicks", () => {
    // A touchscreen Windows laptop must not be sent to a mobile App scheme.
    vi.stubGlobal("navigator", { userAgent: "Windows NT 10.0 Chrome", maxTouchPoints: 10 });
    const view = render(<View />);
    fireEvent.click(screen.getByText("metaMask"));
    expect(links.openWalletDapp).not.toHaveBeenCalled();
    view.unmount();
    vi.stubGlobal("navigator", { userAgent: "Android Mobile Chrome", maxTouchPoints: 1 });
    render(<View />);
    fireEvent.click(screen.getByText("metaMask"), { ctrlKey: true });
    expect(links.openWalletDapp).not.toHaveBeenCalled();
  });
  it("cleans up interception when the selector unmounts", () => {
    const view = render(<View />);
    view.unmount();
    render(
      <div role="dialog" aria-labelledby="rk_connect_title">
        <button data-testid="rk-wallet-option-metaMask" onClick={originalConnect}>
          other
        </button>
      </div>
    );
    fireEvent.click(screen.getByText("other"));
    expect(originalConnect).toHaveBeenCalledOnce();
    expect(links.openWalletDapp).not.toHaveBeenCalled();
  });
});

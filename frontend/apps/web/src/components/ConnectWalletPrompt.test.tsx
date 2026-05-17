import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as React from "react";
import { ConnectWalletPrompt } from "./ConnectWalletPrompt";

const mockOpenConnectModal = vi.fn();

vi.mock("../app-shell/WalletButton", () => ({
  useConnectModal: () => ({ openConnectModal: mockOpenConnectModal })
}));

vi.mock("@ssot/ui", () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p data-testid="description">{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>
}));

vi.mock("next-intl", async () => {
  const messages = (await import("../i18n/locales/en/common.json")).default as Record<
    string,
    unknown
  >;

  function resolveMessage(key: string) {
    return key.split(".").reduce<unknown>((value, part) => {
      if (value && typeof value === "object" && part in value) {
        return (value as Record<string, unknown>)[part];
      }
      return undefined;
    }, messages);
  }

  function translate(key: string, values?: Record<string, string | number>) {
    const message = resolveMessage(`app.${key}`);
    if (typeof message !== "string") return key;
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      message
    );
  }

  return {
    useTranslations: () => translate
  };
});

describe("ConnectWalletPrompt", () => {
  afterEach(() => cleanup());
  it("renders 'Wallet required' title", () => {
    render(<ConnectWalletPrompt />);
    expect(screen.getByText("Wallet required")).toBeDefined();
  });

  it("renders default description when no action provided", () => {
    render(<ConnectWalletPrompt />);
    const desc = screen.getByTestId("description");
    expect(desc.textContent).toContain("Connect a wallet to use this feature");
  });

  it("renders custom action in description", () => {
    render(<ConnectWalletPrompt action="view XP buckets" />);
    const desc = screen.getByTestId("description");
    expect(desc.textContent).toContain("view XP buckets");
  });

  it("renders Connect Wallet button", () => {
    render(<ConnectWalletPrompt />);
    const btn = screen.getByRole("button", { name: /connect wallet/i });
    expect(btn).toBeDefined();
  });

  it("calls openConnectModal on button click", () => {
    mockOpenConnectModal.mockClear();
    render(<ConnectWalletPrompt />);
    const btn = screen.getByRole("button", { name: /connect wallet/i });
    fireEvent.click(btn);
    expect(mockOpenConnectModal).toHaveBeenCalledTimes(1);
  });
});

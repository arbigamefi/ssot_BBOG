import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SharePanel } from "./SharePanel";

vi.mock("@ssot/ui", async () => {
  const actual = await vi.importActual<typeof import("@ssot/ui")>("@ssot/ui");
  return {
    ...actual,
    cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
  };
});

const labels = {
  close: "Close",
  copyLink: "Copy result link",
  copyProof: "Copy proof of fairness",
  linkCopied: "Link copied",
  nativeShare: "Share sheet",
  proofCopied: "Proof copied",
  share: "Share",
  telegram: "Share to Telegram",
  whatsapp: "Share to WhatsApp",
  x: "Share to X"
};

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      media: query,
      matches: query === "(min-width: 768px)" ? !matches : matches,
      removeEventListener: vi.fn()
    }))
  });
}

function renderSharePanel(options: { desktopLayer?: "popover" | "modal" } = {}) {
  return render(
    <div data-testid="clipping-parent" className="overflow-hidden">
      <SharePanel
        desktopLayer={options.desktopLayer}
        labels={labels}
        proof="proof-data"
        text="Won bet"
        title="Bet details"
        url="https://arbigamefi.example/casino/receipt/84532/1?ref=0xabc"
      />
    </div>
  );
}

describe("SharePanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the desktop menu in a body portal so clipped cards cannot cut it off", async () => {
    mockMatchMedia(false);
    renderSharePanel();

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    const menu = await screen.findByRole("menu");
    expect(menu.parentElement).toBe(document.body);
    expect(screen.getByRole("menuitem", { name: "Copy result link" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Share to Telegram" })).toBeDefined();
  });

  it("can render above a modal overlay when used inside result dialogs", async () => {
    mockMatchMedia(false);
    renderSharePanel({ desktopLayer: "modal" });

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    const menu = await screen.findByRole("menu");
    expect(menu.className).toContain("z-[95]");
  });

  it("uses the shared mobile bottom sheet below the md breakpoint", async () => {
    mockMatchMedia(true);
    renderSharePanel();

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Share" })).toBeDefined();
    });
    expect(
      screen.getByText("https://arbigamefi.example/casino/receipt/84532/1?ref=0xabc")
    ).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Copy proof of fairness" })).toBeDefined();
  });

  it("raises the mobile sheet above a result modal when rendered from a modal action", async () => {
    mockMatchMedia(true);
    renderSharePanel({ desktopLayer: "modal" });

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    const dialog = await screen.findByRole("dialog", { name: "Share" });
    expect(dialog.parentElement?.className).toContain("z-[95]");
  });
});

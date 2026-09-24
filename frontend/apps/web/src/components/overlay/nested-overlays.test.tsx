import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "./Drawer";
import { Sheet } from "./Sheet";

function NestedMenus() {
  const [drawer, setDrawer] = React.useState(false);
  const [sheet, setSheet] = React.useState(false);
  return (
    <>
      <button onClick={() => setDrawer(true)}>Open navigation</button>
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        closeLabel="Close navigation"
        title="Navigation"
      >
        <button onClick={() => setSheet(true)}>Choose language</button>
        <a href="/casino">Games</a>
      </Drawer>
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        closeLabel="Close language"
        title="Language"
      >
        <button>English</button>
        <button>中文</button>
      </Sheet>
    </>
  );
}

describe("nested mobile overlays", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.style.overflow = "";
  });

  it("keeps Tab and Escape in the top layer and restores the parent focus and scroll lock", () => {
    render(<NestedMenus />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    trigger.focus();
    fireEvent.click(trigger);
    const language = screen.getByRole("button", { name: "Choose language" });
    language.focus();
    fireEvent.click(language);

    const sheet = screen.getByRole("dialog", { name: "Language" });
    const last = within(sheet).getByRole("button", { name: "中文" });
    const first = within(sheet).getByRole("button", { name: "Close language" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Language" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeDefined();
    expect(document.activeElement).toBe(language);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
  });

  it("closes both mobile layers on desktop resize and restores the original overflow", () => {
    let matches = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        get matches() {
          return matches;
        },
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn)
      }))
    );
    document.body.style.overflow = "auto";
    render(<NestedMenus />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose language" }));
    // A real media-query event can close the parent before its child.
    fireEvent(window, new Event("resize"));
    matches = true;
    // React flushes updates made by the simulated event handler.
    const resize = () => [...listeners].forEach((listener) => listener());
    window.addEventListener("resize", resize);
    fireEvent(window, new Event("resize"));
    window.removeEventListener("resize", resize);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("auto");
    expect(listeners.size).toBe(0);
  });
});

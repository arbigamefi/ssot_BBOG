import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "./Drawer";

describe("Drawer", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("locks body scroll while open and restores it after close", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Drawer closeLabel="Close" onClose={onClose} open title="Menu">
        <a href="/casino">Games</a>
      </Drawer>
    );

    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeDefined();

    rerender(
      <Drawer closeLabel="Close" onClose={onClose} open={false} title="Menu">
        <a href="/casino">Games</a>
      </Drawer>
    );

    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape and backdrop press", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Drawer closeLabel="Close" onClose={onClose} open title="Menu">
        <a href="/casino">Games</a>
      </Drawer>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <Drawer closeLabel="Close" onClose={onClose} open title="Menu">
        <a href="/casino">Games</a>
      </Drawer>
    );

    const backdrop = screen.getByRole("dialog", { name: "Menu" }).parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

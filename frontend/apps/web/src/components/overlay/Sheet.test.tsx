import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sheet } from "./Sheet";

describe("Sheet", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("locks body scroll while open and restores it after close", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet closeLabel="Close" onClose={onClose} open title="Share">
        <button>Copy link</button>
      </Sheet>
    );

    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("dialog", { name: "Share" })).toBeDefined();

    rerender(
      <Sheet closeLabel="Close" onClose={onClose} open={false} title="Share">
        <button>Copy link</button>
      </Sheet>
    );

    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape and backdrop press", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet closeLabel="Close" onClose={onClose} open title="Share">
        <button>Copy link</button>
      </Sheet>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <Sheet closeLabel="Close" onClose={onClose} open title="Share">
        <button>Copy link</button>
      </Sheet>
    );

    const backdrop = screen.getByRole("dialog", { name: "Share" }).parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

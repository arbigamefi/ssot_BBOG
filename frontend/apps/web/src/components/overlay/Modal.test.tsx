import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Modal } from "./Modal";

describe("Modal", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("locks body scroll and focuses the requested action", async () => {
    const onClose = vi.fn();
    const actionRef = React.createRef<HTMLButtonElement>();
    render(
      <Modal
        ariaLabel="Bet details"
        initialFocusRef={actionRef}
        onClose={onClose}
        open
        panelClassName="rounded-md"
      >
        <button ref={actionRef} type="button">
          Play again
        </button>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("dialog", { name: "Bet details" })).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(actionRef.current));
  });

  it("closes on Escape but not on backdrop unless enabled", () => {
    const onClose = vi.fn();
    render(
      <Modal ariaLabel="Bet details" onClose={onClose} open panelClassName="rounded-md">
        <button type="button">Close</button>
      </Modal>
    );

    const backdrop = screen.getByRole("dialog", { name: "Bet details" }).parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop!);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

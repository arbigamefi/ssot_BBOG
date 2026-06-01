import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useFocusTrap } from "./useFocusTrap";

function Trapped({ active }: { active: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(active);
  return (
    <div>
      <button>outside-before</button>
      {active && (
        <div ref={ref} data-testid="trap">
          <button>first</button>
          <button>middle</button>
          <button>last</button>
        </div>
      )}
      <button>outside-after</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  afterEach(() => cleanup());

  it("moves focus into the container on activate", () => {
    render(<Trapped active />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "first" }));
  });

  it("wraps focus from last back to first on Tab", () => {
    render(<Trapped active />);
    const last = screen.getByRole("button", { name: "last" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "first" }));
  });

  it("wraps focus from first to last on Shift+Tab", () => {
    render(<Trapped active />);
    const first = screen.getByRole("button", { name: "first" });
    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "last" }));
  });

  it("restores focus to the previously-focused element on deactivate", () => {
    const { rerender } = render(<Trapped active={false} />);
    const before = screen.getByRole("button", { name: "outside-before" });
    before.focus();
    expect(document.activeElement).toBe(before);

    rerender(<Trapped active />);
    // focus moved into the trap
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "first" }));

    rerender(<Trapped active={false} />);
    // focus restored
    expect(document.activeElement).toBe(before);
  });
});

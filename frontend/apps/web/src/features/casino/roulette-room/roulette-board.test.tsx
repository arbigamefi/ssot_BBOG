import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import en from "../../../i18n/locales/en/common.json";
import { rouletteCoveredNumbers } from "../room/params";
import { RouletteBoard } from "./roulette-board";

function renderBoard(overrides: Partial<React.ComponentProps<typeof RouletteBoard>> = {}) {
  const onToggle = vi.fn();
  const spots = overrides.spots ?? ["RED"];
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <h2 id="layout">Layout</h2>
      <RouletteBoard
        spots={spots}
        covered={new Set(rouletteCoveredNumbers(spots))}
        locked={false}
        marks={{ dolly: null, hit: false, paid: null }}
        call={false}
        paidRef={React.createRef<HTMLButtonElement>()}
        onToggle={onToggle}
        titleId="layout"
        {...overrides}
      />
    </NextIntlClientProvider>
  );
  return { onToggle };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("RouletteBoard", () => {
  it("prints every spot of the layout, with its chip state", () => {
    renderBoard();

    expect(screen.getByRole("group", { name: "Layout" }).querySelectorAll("button")).toHaveLength(
      49
    );
    expect(screen.getByRole("button", { name: "Zero" })).toBeDefined();
    expect(screen.getByRole("button", { name: "17, black" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    const red = screen.getByRole("button", { name: "Red, 18 numbers", pressed: true });
    expect(red).toBeDefined();
    // The numbers under the chip are marked as covered.
    expect(screen.getByRole("button", { name: "3, red" }).hasAttribute("data-covered")).toBe(true);
    expect(screen.getByRole("button", { name: "2, black" }).hasAttribute("data-covered")).toBe(
      false
    );
  });

  it("puts a chip on a spot or takes it off with a tap", () => {
    const { onToggle } = renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "17, black" }));

    expect(onToggle).toHaveBeenCalledWith("17");
  });

  it("previews a spot's numbers on a long press and places no chip", () => {
    vi.useFakeTimers();
    const { onToggle } = renderBoard({ spots: [] });
    const dozen = screen.getByRole("button", { name: "1–12, 12 numbers" });

    fireEvent.pointerDown(dozen, { pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole("button", { name: "1, red" }).hasAttribute("data-preview")).toBe(true);
    expect(screen.getByRole("button", { name: "13, black" }).hasAttribute("data-preview")).toBe(
      false
    );

    fireEvent.pointerUp(dozen, { pointerType: "touch" });
    fireEvent.click(dozen);

    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "1, red" }).hasAttribute("data-preview")).toBe(false);
  });

  it("places a chip on a short tap", () => {
    vi.useFakeTimers();
    const { onToggle } = renderBoard({ spots: [] });
    const zero = screen.getByRole("button", { name: "Zero" });

    fireEvent.pointerDown(zero, { pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(120);
    });
    fireEvent.pointerUp(zero, { pointerType: "touch" });
    fireEvent.click(zero);

    expect(onToggle).toHaveBeenCalledWith("0");
  });

  it("takes no chips while the bet is locked", () => {
    const { onToggle } = renderBoard({ locked: true });
    const seventeen = screen.getByRole("button", { name: "17, black" }) as HTMLButtonElement;

    expect(seventeen.disabled).toBe(true);
    fireEvent.click(seventeen);
    expect(onToggle).not.toHaveBeenCalled();
  });
});

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import en from "../../../i18n/locales/en/common.json";
import { DiceTable } from "./dice-table";

function renderTable(props: Partial<React.ComponentProps<typeof DiceTable>> = {}) {
  const onDirectionChange = vi.fn();
  const onLineChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DiceTable
        direction="under"
        line={50}
        houseEdgeBps={200}
        locked={false}
        onDirectionChange={onDirectionChange}
        onLineChange={onLineChange}
        {...props}
      />
    </NextIntlClientProvider>
  );
  return { onDirectionChange, onLineChange };
}

describe("DiceTable", () => {
  afterEach(cleanup);

  it("prints the win chance before the price, at the same size", () => {
    renderTable({ direction: "over", line: 80 });
    const figures = screen.getByText("Win chance").closest("div")!;
    expect(figures.textContent).toBe("Win chance20%Pays4.90×");
    expect(screen.getByText("Win on 81–100")).toBeDefined();
    expect(screen.getByText("Lose on 1–80")).toBeDefined();
  });

  it("gives the line to the keyboard as a range with its odds in words", () => {
    const { onLineChange } = renderTable();
    const range = screen.getByRole("slider", { name: "Line" });
    expect(range.getAttribute("min")).toBe("2");
    expect(range.getAttribute("max")).toBe("97");
    expect(range.getAttribute("aria-valuetext")).toBe(
      "Win on 1 to 50. 50% chance, pays 1.96 times the stake."
    );
    fireEvent.change(range, { target: { value: "51" } });
    expect(onLineChange).toHaveBeenCalledWith(51);

    fireEvent.click(screen.getByRole("button", { name: "Move the line up one" }));
    expect(onLineChange).toHaveBeenLastCalledWith(51);
    fireEvent.click(screen.getByRole("button", { name: "Move the line down one" }));
    expect(onLineChange).toHaveBeenLastCalledWith(49);
  });

  it("switches side and stops the stepper at the bounds", () => {
    const { onDirectionChange } = renderTable({ direction: "over", line: 98 });
    expect(screen.getByRole("slider", { name: "Line" }).getAttribute("min")).toBe("3");
    expect(
      screen.getByRole("button", { name: "Move the line up one" }).hasAttribute("disabled")
    ).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Low" }));
    expect(onDirectionChange).toHaveBeenCalledWith("under");
  });

  it("locks every control while a bet is out", () => {
    renderTable({ locked: true });
    expect(screen.getByRole("slider", { name: "Line" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("radio", { name: "Low" }).matches(":disabled")).toBe(true);
    expect(
      screen.getByRole("button", { name: "Move the line down one" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("punches the roll into the strip and reports the reveal done", () => {
    vi.useFakeTimers();
    const onPunched = vi.fn();
    renderTable({ locked: true, rolls: [{ value: 67, won: false }], onPunched });
    expect(screen.getByText("67")).toBeDefined();
    act(() => {
      vi.runAllTimers();
    });
    expect(onPunched).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("punches one small hole per round, filled when that round won", () => {
    renderTable({
      direction: "over",
      line: 50,
      locked: true,
      rolls: [
        { value: 66, won: true },
        { value: 45, won: false }
      ]
    });
    const holes = document.querySelectorAll(".rounded-full.size-4");
    expect(holes).toHaveLength(2);
    expect(holes[0]!.className).toContain("bg-ink");
    expect(holes[1]!.className).toContain("bg-paper");
  });
});

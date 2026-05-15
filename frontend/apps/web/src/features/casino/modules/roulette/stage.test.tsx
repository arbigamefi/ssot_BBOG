import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouletteStage } from "./stage";

vi.mock("@ssot/ui", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ")
}));

describe("RouletteStage", () => {
  afterEach(() => cleanup());

  it("toggles straight and outside bets", () => {
    const onChange = vi.fn();
    render(
      <RouletteStage
        isPending={false}
        showResult={false}
        resultNum={null}
        spots={["RED"]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "0" })[0]!);
    expect(onChange).toHaveBeenCalledWith(["RED", "0"]);

    fireEvent.click(screen.getByRole("button", { name: "EVEN" }));
    expect(onChange).toHaveBeenCalledWith(["RED", "EVEN"]);
  });
});

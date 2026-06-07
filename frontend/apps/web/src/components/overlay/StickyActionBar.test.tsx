import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StickyActionBar } from "./StickyActionBar";

describe("StickyActionBar", () => {
  it("renders a single mobile thumb-zone action container", () => {
    render(
      <StickyActionBar>
        <button type="button">Place bet</button>
      </StickyActionBar>
    );

    const action = screen.getByRole("button", { name: "Place bet" });
    const shell = action.parentElement?.parentElement;

    expect(action).toBeDefined();
    expect(shell?.className).toContain("fixed");
    expect(shell?.className).toContain("bottom-0");
    expect(shell?.className).toContain("lg:hidden");
  });
});

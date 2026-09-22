import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";

import { SectionEyebrow } from "./section-eyebrow";

describe("SectionEyebrow", () => {
  it("owns the pill while the call site keeps its own spacing", () => {
    render(<SectionEyebrow className="mb-5">Why us</SectionEyebrow>);
    const eyebrow = screen.getByText("Why us");

    // Appearance belongs to the component. Five sections drifted apart in the
    // first place because each carried its own copy of this class string.
    expect(eyebrow.className).toContain("rounded-full");
    expect(eyebrow.className).toContain("bg-brand-soft");
    expect(eyebrow.className).toContain("tracking-[0.18em]");

    // Spacing stays at the call site: the gap that works under a 72px hero
    // headline is not the gap that works under a 48px section heading.
    expect(eyebrow.className).toContain("mb-5");
  });

  it("gives the hero its own step without a second copy of the class string", () => {
    render(
      <>
        <SectionEyebrow size="hero">Hero</SectionEyebrow>
        <SectionEyebrow>Section</SectionEyebrow>
      </>
    );

    expect(screen.getByText("Hero").className).toContain("text-xs");
    expect(screen.getByText("Section").className).toContain("text-[10px]");

    // Only one font size may reach the element. If both did, which one wins
    // would come down to stylesheet order.
    expect(screen.getByText("Hero").className).not.toContain("text-[10px]");
  });
});

import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CasinoRoundStatusPanel } from "./round-status-panel";

vi.mock("@ssot/ui", () => ({
  cn: (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ")
}));

vi.mock("@heroicons/react/24/solid", () => ({
  CheckIcon: ({ className }: { className?: string }) => (
    <svg data-testid="check" className={className} />
  )
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key.split(".").pop() ?? key
}));

describe("CasinoRoundStatusPanel stepper", () => {
  afterEach(() => cleanup());

  it("hides the stepper before a round is in flight", () => {
    render(<CasinoRoundStatusPanel phase="ready" />);
    // No step circles rendered for idle/ready.
    expect(screen.queryByText("place")).toBeNull();
  });

  it("shows all four steps once placing", () => {
    render(<CasinoRoundStatusPanel phase="placing" />);
    expect(screen.getByText("place")).toBeDefined();
    expect(screen.getByText("random")).toBeDefined();
    expect(screen.getByText("settle")).toBeDefined();
    expect(screen.getByText("result")).toBeDefined();
  });

  it("marks earlier steps complete when waiting for VRF", () => {
    render(<CasinoRoundStatusPanel phase="waiting_vrf" />);
    // Step 1 (place) should be done → check icon present.
    expect(screen.getAllByTestId("check").length).toBeGreaterThanOrEqual(1);
  });

  it("marks all steps complete when settled", () => {
    render(<CasinoRoundStatusPanel phase="settled" />);
    // All four steps complete → four check icons.
    expect(screen.getAllByTestId("check").length).toBe(4);
  });
});

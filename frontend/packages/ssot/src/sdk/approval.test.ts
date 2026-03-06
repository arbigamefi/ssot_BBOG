import { describe, it, expect } from "vitest";
import { planExactApproval } from "./approval";

describe("planExactApproval", () => {
  it("returns no approval when allowance >= required", () => {
    expect(planExactApproval({ allowance: 10n, required: 10n })).toEqual({ needsApproval: false });
    expect(planExactApproval({ allowance: 11n, required: 10n })).toEqual({ needsApproval: false });
  });

  it("approves exact required amount (approve sets allowance, not delta)", () => {
    // allow=1, stake=10 => must approve 10, not (10-1)=9
    expect(planExactApproval({ allowance: 1n, required: 10n })).toEqual({ needsApproval: true, approveAmount: 10n });
  });
});

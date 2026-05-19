import { describe, expect, it } from "vitest";

import { toSportsbookPlayerError } from "./sports-errors";

describe("toSportsbookPlayerError", () => {
  it("maps expired odds to actionable player copy", () => {
    expect(toSportsbookPlayerError(new Error("execution reverted: OddsExpired(6, 1, 2)"))).toBe(
      "This price expired. Refresh the market and place the ticket again."
    );
  });

  it("maps risk cap failures to a smaller-stake suggestion", () => {
    expect(toSportsbookPlayerError("RiskCapExceeded outcome exposure")).toBe(
      "This ticket exceeds the current risk limit. Try a smaller stake."
    );
  });

  it("scrubs noisy contract call tails for unknown failures", () => {
    expect(toSportsbookPlayerError("Unexpected revert\nContract Call: placeTicket(...)")).toBe(
      "Unexpected revert"
    );
  });
});

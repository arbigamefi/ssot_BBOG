import { describe, expect, it } from "vitest";

import { __test__ } from "./dev-flags";

describe("dev-only flags", () => {
  it("enables explicit flags outside production", () => {
    expect(__test__.devOnlyFlag("true", "development")).toBe(true);
    expect(__test__.devOnlyFlag("true", "test")).toBe(true);
  });

  it("ignores disabled or missing values", () => {
    expect(__test__.devOnlyFlag("false", "development")).toBe(false);
    expect(__test__.devOnlyFlag(undefined, "development")).toBe(false);
  });

  it("never enables flags in production", () => {
    expect(__test__.devOnlyFlag("true", "production")).toBe(false);
  });
});

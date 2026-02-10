import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    const showB = false as boolean;
    expect(cn("a", showB && "b", "c")).toBe("a c");
  });
});

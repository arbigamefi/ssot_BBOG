import { describe, expect, it } from "vitest";

import { resolveBetIndexResumeBlock } from "./runtime.js";

describe("resolveBetIndexResumeBlock", () => {
  it("resumes from a durable cursor only when it is ahead of the configured start", () => {
    expect(resolveBetIndexResumeBlock(100n, 250n)).toBe(250n);
    expect(resolveBetIndexResumeBlock(100n, 100n)).toBe(100n);
    expect(resolveBetIndexResumeBlock(100n, 75n)).toBe(100n);
    expect(resolveBetIndexResumeBlock(100n, null)).toBe(100n);
  });
});

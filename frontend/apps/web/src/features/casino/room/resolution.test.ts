import { describe, expect, it } from "vitest";

import { appendGameHistoryEntry } from "./resolution";

describe("game room resolution helpers", () => {
  it("prepends resolved game history and caps the visible feed", () => {
    const history = [
      { val: 1, win: false },
      { val: 2, win: true },
      { val: 3, win: false },
      { val: 4, win: true },
      { val: 5, win: false }
    ];

    expect(appendGameHistoryEntry(history, { val: 99, win: true })).toEqual([
      { val: 99, win: true },
      { val: 1, win: false },
      { val: 2, win: true },
      { val: 3, win: false },
      { val: 4, win: true }
    ]);
  });
});

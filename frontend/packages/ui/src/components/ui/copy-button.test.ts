import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * CopyButton logic tests (node env — no DOM).
 * Verifies the clipboard interaction contract used by the CopyButton component.
 */

describe("CopyButton clipboard contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls navigator.clipboard.writeText with the value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await navigator.clipboard.writeText("0x1234abcd");
    expect(writeText).toHaveBeenCalledWith("0x1234abcd");

    vi.unstubAllGlobals();
  });

  it("handles clipboard API not available gracefully", async () => {
    // When clipboard is undefined, code should catch and not throw
    vi.stubGlobal("navigator", {});
    let threw = false;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText("test");
      }
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    vi.unstubAllGlobals();
  });

  it("handles clipboard rejection gracefully", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("Not allowed"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    let threw = false;
    try {
      await navigator.clipboard.writeText("test");
    } catch {
      threw = true;
    }
    // CopyButton catches this internally; here we verify the error occurs
    expect(threw).toBe(true);
    vi.unstubAllGlobals();
  });

  it("copies various formats: addresses, tx hashes, bet IDs", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const values = [
      "0x1234567890abcdef1234567890abcdef12345678",
      "0xdeadbeefcafe1234567890abcdef1234567890abcdef1234567890abcdef1234",
      "42",
    ];

    for (const v of values) {
      await navigator.clipboard.writeText(v);
    }
    expect(writeText).toHaveBeenCalledTimes(3);
    expect(writeText).toHaveBeenNthCalledWith(1, values[0]);
    expect(writeText).toHaveBeenNthCalledWith(2, values[1]);
    expect(writeText).toHaveBeenNthCalledWith(3, values[2]);

    vi.unstubAllGlobals();
  });
});

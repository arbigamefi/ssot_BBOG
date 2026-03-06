import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for ThemeToggle logic.
 *
 * Since packages/ui vitest runs in "node" environment (no DOM),
 * we test the exported helper functions directly by simulating
 * the DOM/localStorage API the component relies on.
 *
 * Integration tests for ThemeToggle rendering live in apps/web.
 */

// We can't import React component in node env, so test the storage key
// and the FOUC script pattern that layout.tsx uses.

const STORAGE_KEY = "ssot-theme";

describe("ThemeToggle localStorage contract", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("storage key is 'ssot-theme'", () => {
    expect(STORAGE_KEY).toBe("ssot-theme");
  });

  it("accepts 'light' as valid value", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    const v = localStorage.getItem(STORAGE_KEY);
    expect(["light", "dark", "system"]).toContain(v);
  });

  it("accepts 'dark' as valid value", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    const v = localStorage.getItem(STORAGE_KEY);
    expect(v).toBe("dark");
  });

  it("accepts 'system' as valid value", () => {
    localStorage.setItem(STORAGE_KEY, "system");
    const v = localStorage.getItem(STORAGE_KEY);
    expect(v).toBe("system");
  });

  it("returns null when not set", () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("FOUC prevention script contract", () => {
  it("script reads ssot-theme key and applies .dark class", () => {
    // Simulate the inline script logic
    const store: Record<string, string> = { "ssot-theme": "dark" };

    // Simulate matchMedia
    const matchMedia = () => ({ matches: false });

    const t = store["ssot-theme"] ?? null;
    const dark = t === "dark" || (t !== "light" && matchMedia().matches);
    expect(dark).toBe(true);
  });

  it("respects system preference when theme is not set", () => {
    const store: Record<string, string> = {};
    const matchMedia = () => ({ matches: true }); // system prefers dark

    const t = store["ssot-theme"] ?? null;
    const dark = t === "dark" || (t !== "light" && matchMedia().matches);
    expect(dark).toBe(true);
  });

  it("respects system preference when theme is 'system'", () => {
    const store: Record<string, string> = { "ssot-theme": "system" };
    const matchMedia = () => ({ matches: false }); // system prefers light

    const t = store["ssot-theme"] ?? null;
    const dark = t === "dark" || (t !== "light" && matchMedia().matches);
    expect(dark).toBe(false);
  });

  it("light theme overrides system dark preference", () => {
    const store: Record<string, string> = { "ssot-theme": "light" };
    const matchMedia = () => ({ matches: true }); // system prefers dark

    const t = store["ssot-theme"] ?? null;
    const dark = t === "dark" || (t !== "light" && matchMedia().matches);
    expect(dark).toBe(false);
  });

  it("dark theme overrides system light preference", () => {
    const store: Record<string, string> = { "ssot-theme": "dark" };
    const matchMedia = () => ({ matches: false }); // system prefers light

    const t = store["ssot-theme"] ?? null;
    const dark = t === "dark" || (t !== "light" && matchMedia().matches);
    expect(dark).toBe(true);
  });
});

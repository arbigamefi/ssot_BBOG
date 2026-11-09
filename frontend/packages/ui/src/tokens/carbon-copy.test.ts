import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./carbon-copy.css", import.meta.url), "utf8");
const globals = readFileSync(new URL("../styles/globals.css", import.meta.url), "utf8");

function channels(name: string): [number, number, number] {
  const match = css.match(new RegExp(`--${name}: ([\\d.]+) ([\\d.]+)% ([\\d.]+)%;`));
  if (!match) throw new Error(`--${name} is not an HSL token in carbon-copy.css`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function luminance(name: string) {
  const [h, s, l] = channels(name);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(0) + 0.7152 * f(8) + 0.0722 * f(4);
}

function rgb(name: string): [number, number, number] {
  const [h, s, l] = channels(name);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function relative([r, g, b]: [number, number, number]) {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg: [number, number, number], bg: [number, number, number]) {
  const a = relative(fg);
  const b = relative(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function contrast(fg: string, bg: string) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("Carbon copy palette", () => {
  it.each([
    ["paper", "carbon"],
    ["on-carbon-muted", "carbon"],
    ["on-carbon-muted", "carbon-deep"],
    ["carbon", "paper"],
    ["ink", "paper"],
    ["ink-bright", "paper"],
    ["faded", "paper"]
  ])("%s text on %s meets WCAG AA for body text", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps ink off carbon and thermal off control edges, as the token file says", () => {
    expect(contrast("ink", "carbon")).toBeLessThan(3);
    expect(contrast("thermal", "paper")).toBeLessThan(3);
    expect(contrast("faded", "paper")).toBeGreaterThanOrEqual(3);
  });

  it("maps every token onto a Tailwind utility", () => {
    for (const name of [
      "carbon",
      "carbon-deep",
      "paper",
      "ink",
      "ink-bright",
      "faded",
      "thermal",
      "on-carbon-muted"
    ]) {
      expect(globals).toContain(`--color-${name}: hsl(var(--${name}));`);
    }
    for (const name of ["note", "body", "lede", "heading", "display", "price", "total"]) {
      expect(css).toContain(`--type-${name}:`);
      expect(globals).toContain(`--text-${name}: var(--type-${name});`);
    }
  });

  it("keeps the print on a table's felt readable", () => {
    // Print is paper over the felt at 92%, 60% and 24% (globals.css); 24% draws ticks only.
    const over = (alpha: number, bg: string) => {
      const [paper, felt] = [rgb("paper"), rgb(bg)];
      return paper.map((c, i) => alpha * c + (1 - alpha) * felt[i]!) as [number, number, number];
    };
    for (const bg of ["felt", "felt-edge"]) {
      expect(ratio(over(0.92, bg), rgb(bg))).toBeGreaterThanOrEqual(7);
      expect(ratio(over(0.6, bg), rgb(bg))).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(over(0.24, "felt"), rgb("felt"))).toBeLessThan(3);
  });

  it("maps the table's materials onto utilities", () => {
    for (const name of ["felt", "felt-edge", "rail"]) {
      expect(globals).toContain(`--color-${name}: hsl(var(--${name}));`);
    }
    for (const name of [
      "groove-hi",
      "groove-lo",
      "rail-hi",
      "rail-lo",
      "ivory",
      "ivory-hi",
      "ivory-lo",
      "lamp"
    ]) {
      channels(name);
    }
    for (const [name, alpha] of [
      ["print", 0.92],
      ["print-soft", 0.6],
      ["print-faint", 0.24]
    ] as const) {
      expect(globals).toContain(`--color-${name}: hsl(var(--paper) / ${alpha});`);
    }
  });

  it("never scales type with the viewport width", () => {
    expect(css).not.toMatch(/--type-[a-z]+:[^;]*vw/);
  });
});

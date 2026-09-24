// @vitest-environment node
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

// Resolve the actual transitive dependency used by RainbowKit, so an install
// or Docker build that loses the compatibility patch cannot silently pass.
const require = createRequire(import.meta.url);
const rainbowRequire = createRequire(require.resolve("@rainbow-me/rainbowkit"));
const cuerRequire = createRequire(rainbowRequire.resolve("cuer"));
const { create } = await import(pathToFileURL(cuerRequire.resolve("cuer/QrCode")).href);
const { Cuer } = await import(pathToFileURL(rainbowRequire.resolve("cuer")).href);
const { encodeQR } = await import(pathToFileURL(cuerRequire.resolve("qr")).href);

// Synthetic pairing data only; never persist a real connection URI in tests.
const pairing = `wc:${"a".repeat(64)}@2?relay-protocol=irn&symKey=${"b".repeat(64)}`;

describe("RainbowKit QR dependency compatibility", () => {
  it.each([
    ["WalletConnect pairing", pairing],
    ["MetaMask pairing", `https://metamask.app.link/wc?uri=${encodeURIComponent(pairing)}`],
    ["wallet download", "https://metamask.io/download"]
  ])("renders %s without crashing or shifting QR finder positions", (_name, value) => {
    const qr = create(value, { errorCorrection: "medium" });
    // Compare to an independently padded encoding. The custom renderer needs
    // the symbol matrix only; retaining the padding would misplace finders.
    const padded: boolean[][] = encodeQR(value, "raw", { border: 4, ecc: "medium" });
    expect(qr.grid).toEqual(padded.slice(4, -4).map((row) => row.slice(4, -4)));
    expect((qr.edgeLength - 17) % 4).toBe(0);
    expect(qr.grid.every((row: boolean[]) => row.length === qr.edgeLength)).toBe(true);
    expect(qr.grid[0].slice(0, 7)).toEqual(Array(7).fill(true));
    const html = renderToStaticMarkup(
      createElement(
        Cuer.Root,
        { value, errorCorrection: "medium", size: 240 },
        createElement(Cuer.Cells),
        createElement(Cuer.Finder)
      )
    );
    expect(html).toContain("<svg");
    expect(html).toContain("<path");
  });
});

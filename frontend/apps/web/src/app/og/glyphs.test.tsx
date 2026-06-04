import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OgGlyph, type OgGlyphKind } from "./glyphs";
import { CASINO_MODULE_SLUGS } from "../../features/casino/modules";

const render = (kind: OgGlyphKind) => renderToStaticMarkup(<OgGlyph kind={kind} size={120} />);

describe("OG game glyphs", () => {
  // Drift guard: the OG hero visual for each game is hand-ported from the
  // product CasinoMiniIcons. Unknown kinds fall back to the generic receipt
  // mark, so a newly registered game must have its own glyph or this fails.
  it("renders a dedicated mark for every registered casino game", () => {
    const fallback = render("__missing__" as OgGlyphKind);
    for (const slug of CASINO_MODULE_SLUGS) {
      const markup = render(slug);
      expect(markup, `OG glyph for "${slug}" should render an <svg>`).toContain("<svg");
      expect(markup, `"${slug}" must have its own OG glyph, not the fallback`).not.toBe(fallback);
    }
  });
});

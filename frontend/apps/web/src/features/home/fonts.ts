import localFont from "next/font/local";

// Carbon copy faces (docs/design/10-design-tokens.md §4). They fill the variables
// carbon-copy.css names. The root layout sets them on <html>: the site header and
// footer on every page are set in Schibsted.
// The files are in the repo (SIL OFL 1.1, licences beside them) so a build never
// depends on what Google Fonts returns that day. Chinese uses the system's own
// Chinese face; see the stacks in packages/ui globals.css.

// Variable weight 400–800, Latin and Latin Extended (Portuguese, Turkish).
const schibsted = localFont({
  src: "./fonts/SchibstedGrotesk-latin-wght.woff2",
  weight: "400 800",
  variable: "--font-schibsted",
  display: "swap"
});

// Doto prints figures only: Latin at 800.
const doto = localFont({
  src: "./fonts/Doto-latin-800.woff2",
  weight: "800",
  variable: "--font-doto",
  display: "swap"
});

export const carbonCopyFontVariables = `${schibsted.variable} ${doto.variable}`;

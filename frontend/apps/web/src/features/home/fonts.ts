import { Doto, Noto_Sans_SC, Schibsted_Grotesk } from "next/font/google";

// Carbon copy faces (docs/design/10-design-tokens.md §4). They fill the variables
// carbon-copy.css names, so only pages that set them on a wrapper load them.
const schibsted = Schibsted_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "800"],
  variable: "--font-schibsted",
  display: "swap"
});

// Doto prints figures only.
const doto = Doto({
  subsets: ["latin"],
  weight: "800",
  variable: "--font-doto",
  display: "swap"
});

// Google serves Chinese in unicode-range slices, so nothing is preloaded and the
// browser fetches only the slices a page uses.
const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  display: "swap",
  preload: false
});

export function carbonCopyFontVariables(locale: string) {
  const variables = [schibsted.variable, doto.variable];
  if (locale === "zh-Hans") variables.push(notoSansSC.variable);
  return variables.join(" ");
}

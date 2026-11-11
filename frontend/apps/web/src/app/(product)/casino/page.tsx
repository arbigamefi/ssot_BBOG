import type { Metadata } from "next";

import { carbonCopyFontVariables } from "../../../features/home/fonts";
import { generatePageMetadata } from "../../../i18n/metadata";
import { CasinoLobbyClient } from "./pageClient";

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("casino", undefined, { path: "/casino" });
}

export default function CasinoLobbyPage() {
  return (
    <div className={carbonCopyFontVariables}>
      <CasinoLobbyClient />
    </div>
  );
}

import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { generatePageMetadata } from "../../../i18n/metadata";
import { LoadingSportsbook } from "./LoadingSportsbook";

const SportsbookPageClient = dynamic(
  () => import("./pageClient").then((m) => ({ default: m.SportsbookPageClient })),
  {
    loading: () => <LoadingSportsbook />
  }
);

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("sportsbook");
}

export default function SportsbookPage() {
  return <SportsbookPageClient />;
}

import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { generatePageMetadata } from "../../../i18n/metadata";
import { LoadingGames } from "./LoadingGames";

const GamesListClient = dynamic(
  () => import("./pageClient").then((m) => ({ default: m.GamesListClient })),
  {
    loading: () => <LoadingGames />
  }
);

export function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata("casino");
}

export default function GamesPage() {
  return <GamesListClient />;
}

import dynamic from "next/dynamic";

import { LoadingGames } from "./LoadingGames";

const GamesListClient = dynamic(
  () => import("./pageClient").then((m) => ({ default: m.GamesListClient })),
  {
    loading: () => <LoadingGames />
  }
);

export default function GamesPage() {
  return <GamesListClient />;
}

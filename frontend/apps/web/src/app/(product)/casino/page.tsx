import dynamic from "next/dynamic";

const GamesListClient = dynamic(
  () => import("./pageClient").then((m) => ({ default: m.GamesListClient })),
  {
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading games...</p>
      </div>
    )
  }
);

export default function GamesPage() {
  return <GamesListClient />;
}

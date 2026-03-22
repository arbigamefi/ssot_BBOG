import dynamic from "next/dynamic";

const GamePageClient = dynamic(() => import("../games/[slug]/pageClient").then((m) => ({ default: m.GamePageClient })), {
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading game...</p>
    </div>
  ),
});

export default function KenoPage() {
  return <GamePageClient slug="keno" />;
}

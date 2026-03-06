import dynamic from "next/dynamic";
import { use } from "react";

const GamePageClient = dynamic(() => import("./pageClient").then((m) => ({ default: m.GamePageClient })), {
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading game...</p>
    </div>
  ),
});

export default function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <GamePageClient slug={slug} />;
}

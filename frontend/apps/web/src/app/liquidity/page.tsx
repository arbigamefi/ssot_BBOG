import dynamic from "next/dynamic";

const LiquidityPageClient = dynamic(
  () => import("./pageClient").then((m) => ({ default: m.LiquidityPageClient })),
  {
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading liquidity...</p>
      </div>
    ),
  }
);

export default function LiquidityPage() {
  return <LiquidityPageClient />;
}

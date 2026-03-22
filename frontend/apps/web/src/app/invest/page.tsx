import dynamic from "next/dynamic";

const LiquidityPageClient = dynamic(
  () => import("../liquidity/pageClient").then((m) => ({ default: m.LiquidityPageClient })),
  {
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading investment...</p>
      </div>
    ),
  }
);

export default function InvestPage() {
  return <LiquidityPageClient />;
}

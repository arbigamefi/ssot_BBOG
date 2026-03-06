import dynamic from "next/dynamic";

const ClaimsPageClient = dynamic(
  () => import("./pageClient").then((m) => ({ default: m.ClaimsPageClient })),
  {
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading claims...</p>
      </div>
    ),
  }
);

export default function ClaimsPage() {
  return <ClaimsPageClient />;
}

import dynamic from "next/dynamic";

const SportsbookPageClient = dynamic(
  () => import("./pageClient").then((m) => ({ default: m.SportsbookPageClient })),
  {
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-white/48">Loading sportsbook...</p>
      </div>
    )
  }
);

export default function SportsbookPage() {
  return <SportsbookPageClient />;
}

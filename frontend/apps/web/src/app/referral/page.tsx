import dynamic from "next/dynamic";

const ReferralPageClient = dynamic(
  () => import("./pageClient").then((m) => ({ default: m.ReferralPageClient })),
  {
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading referral...</p>
      </div>
    ),
  }
);

export default function ReferralPage() {
  return <ReferralPageClient />;
}

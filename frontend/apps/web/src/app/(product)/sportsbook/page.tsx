import dynamic from "next/dynamic";

import { LoadingSportsbook } from "./LoadingSportsbook";

const SportsbookPageClient = dynamic(
  () => import("./pageClient").then((m) => ({ default: m.SportsbookPageClient })),
  {
    loading: () => <LoadingSportsbook />
  }
);

export default function SportsbookPage() {
  return <SportsbookPageClient />;
}

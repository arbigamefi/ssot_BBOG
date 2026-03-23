import { redirect } from "next/navigation";

const CANONICAL_ROOM_ROUTES: Record<string, string> = {
  roulette: "/roulette",
  dice: "/dice",
  "coin-toss": "/cointoss",
  cointoss: "/cointoss",
  keno: "/keno"
};

export default async function GameCompatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(CANONICAL_ROOM_ROUTES[slug] ?? "/games");
}

import { redirect } from "next/navigation";

const SLUG_ALIASES: Record<string, string> = {
  cointoss: "coin-toss"
};

export default async function GameRoomCompatPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/casino/${SLUG_ALIASES[slug] ?? slug}`);
}

import { redirect } from "next/navigation";

export default async function BetDetailCompatPage({
  params
}: {
  params: Promise<{ betId: string }>;
}) {
  const { betId } = await params;
  redirect(`/portfolio/activity/${betId}`);
}

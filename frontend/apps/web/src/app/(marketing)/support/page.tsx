import type { Metadata } from "next";

import { FaqAccordion } from "../../../features/support/FaqAccordion";
import { getRequestI18n } from "../../../i18n/request";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getRequestI18n();
  const support = (messages as Record<string, any>).support?.faq ?? {};
  return {
    title: support.title ? `${support.title} | ArbiGameFi` : "Help & FAQ | ArbiGameFi",
    description: support.description ?? "Answers to common questions about ArbiGameFi."
  };
}

export default function SupportPage() {
  return <FaqAccordion />;
}

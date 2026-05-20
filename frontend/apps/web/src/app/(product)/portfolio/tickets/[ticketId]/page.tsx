import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { generatePageMetadata } from "../../../../../i18n/metadata";
import { SportsTicketDetailPageClient } from "./pageClient";

export async function generateMetadata({
  params
}: {
  params: Promise<{ ticketId: string }>;
}): Promise<Metadata> {
  const { ticketId } = await params;
  if (!/^[0-9]+$/.test(ticketId)) notFound();

  return generatePageMetadata("portfolioSportsTicket", { ticketId });
}

export default async function SportsTicketDetailPage({
  params
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;

  if (!/^[0-9]+$/.test(ticketId)) {
    notFound();
  }

  return <SportsTicketDetailPageClient ticketId={ticketId} />;
}

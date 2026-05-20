import type { Metadata } from "next";

import { getRequestI18n } from "../../i18n/request";
import type { LegalSlug } from "./content";

export async function generateLegalMetadata(slug: LegalSlug): Promise<Metadata> {
  const { messages } = await getRequestI18n();
  const page = messages.legal.pages[slug];

  return {
    title: page.title,
    description: page.description
  };
}

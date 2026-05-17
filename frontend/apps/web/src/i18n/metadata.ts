import type { Metadata } from "next";

import { getRequestI18n } from "./request";
import type { AppMessages } from "./messages";

type PageMetadataKey = keyof AppMessages["metadata"]["pages"];

function interpolate(template: string, values: Record<string, string> = {}) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => values[key] ?? match);
}

export function buildPageMetadata(
  messages: AppMessages,
  key: PageMetadataKey,
  values?: Record<string, string>
): Metadata {
  const page = messages.metadata.pages[key];
  return {
    title: interpolate(page.title, values),
    description: interpolate(page.description, values)
  };
}

export async function generatePageMetadata(
  key: PageMetadataKey,
  values?: Record<string, string>
): Promise<Metadata> {
  const { messages } = await getRequestI18n();
  return buildPageMetadata(messages, key, values);
}

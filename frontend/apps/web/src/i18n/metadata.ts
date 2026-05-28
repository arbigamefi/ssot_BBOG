import type { Metadata } from "next";

import { getRequestI18n } from "./request";
import type { AppMessages } from "./messages";
import { SITE_URL } from "../config/site";

type PageMetadataKey = keyof AppMessages["metadata"]["pages"];

type PageMetadataOptions = {
  /** Absolute path (e.g. "/casino") to emit as canonical. */
  path?: string;
  /** Mark the page noindex (account / ops surfaces). */
  noindex?: boolean;
};

function interpolate(template: string, values: Record<string, string> = {}) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => values[key] ?? match);
}

export function buildPageMetadata(
  messages: AppMessages,
  key: PageMetadataKey,
  values?: Record<string, string>,
  options: PageMetadataOptions = {}
): Metadata {
  const page = messages.metadata.pages[key];
  const title = interpolate(page.title, values);
  const description = interpolate(page.description, values);

  const meta: Metadata = { title, description };

  if (options.path) {
    const canonical = options.path === "/" ? SITE_URL : `${SITE_URL}${options.path}`;
    meta.alternates = { canonical };
    // Mirror title/description onto OG so per-page shares are accurate; the
    // image comes from the file-based opengraph-image convention.
    meta.openGraph = { title, description, url: canonical };
    meta.twitter = { title, description };
  }

  if (options.noindex) {
    meta.robots = { index: false, follow: false };
  }

  return meta;
}

export async function generatePageMetadata(
  key: PageMetadataKey,
  values?: Record<string, string>,
  options?: PageMetadataOptions
): Promise<Metadata> {
  const { messages } = await getRequestI18n();
  return buildPageMetadata(messages, key, values, options);
}

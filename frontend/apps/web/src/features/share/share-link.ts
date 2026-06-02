import { normalizeReferralAddress } from "../referral/referral-link";

export type SharePlatform = "telegram" | "whatsapp" | "x";

const DEFAULT_ORIGIN = "https://arbigamefi.invalid";

export function buildShareUrl({ href, referrer }: { href: string; referrer?: string | null }) {
  try {
    const url = new URL(href, DEFAULT_ORIGIN);
    const normalizedReferrer = normalizeReferralAddress(referrer);
    if (normalizedReferrer) url.searchParams.set("ref", normalizedReferrer);
    return url.origin === DEFAULT_ORIGIN
      ? `${url.pathname}${url.search}${url.hash}`
      : url.toString();
  } catch {
    return href;
  }
}

export function buildShareSummary({ text, url }: { text: string; url: string }) {
  const trimmedText = text.trim();
  const trimmedUrl = url.trim();
  if (!trimmedText) return trimmedUrl;
  if (!trimmedUrl) return trimmedText;
  return `${trimmedText} · ${trimmedUrl}`;
}

export function buildShareIntentUrl({
  platform,
  text,
  url
}: {
  platform: SharePlatform;
  text: string;
  url: string;
}) {
  const summary = buildShareSummary({ text, url });

  if (platform === "telegram") {
    const intent = new URL("https://t.me/share/url");
    intent.searchParams.set("url", url);
    intent.searchParams.set("text", text);
    return intent.toString();
  }

  if (platform === "whatsapp") {
    const intent = new URL("https://wa.me/");
    intent.searchParams.set("text", summary);
    return intent.toString();
  }

  const intent = new URL("https://twitter.com/intent/tweet");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", url);
  return intent.toString();
}

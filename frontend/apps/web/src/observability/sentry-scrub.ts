const ADDRESS_PATTERN = /\b0x[a-fA-F0-9]{40}\b/g;
const PRIVATE_PARAM_PATTERN = /([?&](?:privateKey|private_key|pk|signature)=)[^&#\s]+/gi;

export function scrubSentryText(value: string) {
  return value.replace(ADDRESS_PATTERN, "0xREDACTED").replace(PRIVATE_PARAM_PATTERN, "$1REDACTED");
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return value;
  if (typeof value === "string") return scrubSentryText(value);
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    (value as Record<string, unknown>)[key] = scrubValue(nested, depth + 1);
  }
  return value;
}

export function scrubSentryEvent<T>(event: T): T {
  return scrubValue(event) as T;
}

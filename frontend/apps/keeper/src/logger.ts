import { redactUrls } from "./errors.js";
import type { KeeperLogFields, KeeperLogger } from "./types.js";

/** Written by the logger itself; a caller field never replaces them. */
const OWNED_KEYS = new Set(["level", "message", "ts"]);

function write(level: "info" | "warn" | "error", message: string, fields?: KeeperLogFields) {
  const payload: Record<string, unknown> = {
    level,
    message,
    ts: new Date().toISOString()
  };
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (!OWNED_KEYS.has(key)) payload[key] = value;
  }
  // An untyped caller may still pass error text as `message`; keep it as `error`.
  const stray = (fields as Record<string, unknown> | undefined)?.message;
  if (stray !== undefined && payload.error === undefined) payload.error = stray;
  // RPC URLs carry API keys, so no URL reaches a log line.
  const line = JSON.stringify(payload, (_key, value: unknown) =>
    typeof value === "string" ? redactUrls(value) : value
  );
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger: KeeperLogger = {
  info: (message, fields) => write("info", message, fields),
  warn: (message, fields) => write("warn", message, fields),
  error: (message, fields) => write("error", message, fields)
};

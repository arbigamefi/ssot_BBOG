import type { KeeperLogger } from "./types.js";

function write(
  level: "info" | "warn" | "error",
  message: string,
  fields?: Record<string, unknown>
) {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...(fields ?? {})
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger: KeeperLogger = {
  info: (message, fields) => write("info", message, fields),
  warn: (message, fields) => write("warn", message, fields),
  error: (message, fields) => write("error", message, fields)
};

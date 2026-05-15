export function formatUtcDateTime(value: Date | number | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function formatRelativeTime(value: Date | number | string, now = Date.now()) {
  const then = new Date(value).getTime();
  const diffSeconds = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSeconds);

  const units = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1]
  ] as const;

  const [unit, seconds] =
    units.find(([, unitSeconds]) => abs >= unitSeconds) ?? (["second", 1] as const);

  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round(diffSeconds / seconds),
    unit
  );
}

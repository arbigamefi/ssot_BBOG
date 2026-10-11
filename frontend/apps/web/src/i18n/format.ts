/** A unix-seconds instant as a date and time in the reader's locale and local time zone. */
export function formatLocalDateTime(unixSeconds: number, locale: string, timeZone?: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {})
  }).format(new Date(unixSeconds * 1000));
}

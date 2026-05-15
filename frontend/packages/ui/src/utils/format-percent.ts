export function formatPercent(
  value: number,
  {
    maximumFractionDigits = 2,
    minimumFractionDigits = 0,
    locale = "en-US"
  }: Intl.NumberFormatOptions & { locale?: string } = {}
) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits,
    style: "percent"
  }).format(value);
}

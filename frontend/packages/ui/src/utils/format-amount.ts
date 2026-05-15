export type FormatAmountOptions = {
  decimals?: number;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  locale?: string;
};

export function formatAmount(
  value: bigint,
  {
    decimals = 18,
    maximumFractionDigits = 4,
    minimumFractionDigits = 0,
    locale = "en-US"
  }: FormatAmountOptions = {}
) {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;
  const formattedWhole = groupDecimalString(whole.toString(), locale);

  if (fraction === 0n || maximumFractionDigits === 0) {
    return `${negative ? "-" : ""}${formattedWhole}`;
  }

  const paddedFraction = fraction.toString().padStart(decimals, "0");
  const visibleFraction = paddedFraction.slice(0, maximumFractionDigits).replace(/0+$/, "");
  const finalFraction = visibleFraction.padEnd(minimumFractionDigits, "0");

  return `${negative ? "-" : ""}${formattedWhole}${finalFraction ? `.${finalFraction}` : ""}`;
}

function groupDecimalString(value: string, locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(1111);
  const group = parts.find((part) => part.type === "group")?.value ?? ",";
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

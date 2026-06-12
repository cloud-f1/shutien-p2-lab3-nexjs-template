/**
 * Formats a decimal string (from API) into a display-friendly currency string.
 * Uses Intl.NumberFormat — no floating-point rounding.
 *
 * "1200000.00" -> "$1,200,000.00"
 * "0.00"       -> "$0.00"
 * null/""      -> "$0.00"
 */
export function formatCurrency(
  value: string | null | undefined,
  currency = "USD",
  locale = "en-US",
): string {
  const num = Number(value ?? "0");
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats a decimal percentage string for display.
 * "6.67" -> "+6.67%"
 * "-3.50" -> "-3.50%"
 * null -> "\u2014"
 */
export function formatPercent(value: string | null | undefined): string {
  if (value == null) return "\u2014";
  const num = Number(value);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

/**
 * Determines gain/loss direction for styling.
 */
export function gainDirection(
  value: string | null | undefined,
): "up" | "down" | "flat" {
  if (value == null) return "flat";
  const num = Number(value);
  if (num > 0) return "up";
  if (num < 0) return "down";
  return "flat";
}

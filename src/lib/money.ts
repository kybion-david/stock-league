const euro = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

/** Formats integer euro cents for display, e.g. 123456 → "€1,234.56". */
export function formatEuroCents(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new TypeError(`Expected integer cents, got ${cents}`);
  }
  return euro.format(cents / 100);
}

const MINUS = "−";

/** A gain or loss with its sign, e.g. 1234 → "+€12.34", −50 → "−€0.50", 0 → "€0.00". */
export function formatSignedEuroCents(cents: number): string {
  const text = formatEuroCents(Math.abs(cents));
  return cents > 0 ? `+${text}` : cents < 0 ? `${MINUS}${text}` : text;
}

/**
 * A rate as a signed percentage with two decimals, e.g. 0.0523 → "+5.23%".
 * Anything that rounds to zero is "0.00%", without a sign.
 */
export function formatSignedPercent(rate: number): string {
  const text = Math.abs(rate * 100).toFixed(2);
  if (text === "0.00") return "0.00%";
  return `${rate > 0 ? "+" : MINUS}${text}%`;
}

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

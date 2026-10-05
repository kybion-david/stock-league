import type { TransactionType } from "@/lib/ledger";
import { formatEuroCents } from "@/lib/money";

export const TYPE_LABELS: Record<TransactionType, string> = {
  buy: "Buy",
  sell: "Sell",
  fee: "Fee",
  dividend: "Dividend",
};

/** The amount with the sign it has on cash: "−€400.00" for a buy, "+€1.20" for a dividend. */
export function signedAmount(type: TransactionType, cents: number): string {
  const out = type === "buy" || type === "fee";
  return `${out ? "−" : "+"}${formatEuroCents(cents)}`;
}

/** Integer cents as the form's amount text, e.g. 40050 → "400.50". */
export function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

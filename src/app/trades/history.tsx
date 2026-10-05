import Link from "next/link";
import { formatDay } from "@/lib/leaderboard";
import type { Transaction } from "@/lib/transactions";
import { signedAmount, TYPE_LABELS } from "./format";

/** A player's transactions, newest first. Each row opens its edit page. */
export function TransactionHistory({
  playerId,
  transactions,
}: {
  playerId: number;
  transactions: Transaction[];
}) {
  if (transactions.length === 0) {
    return <p className="text-foreground/60">Nothing entered yet.</p>;
  }
  return (
    <ul className="divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
      {transactions.map((t) => (
        <li key={t.id}>
          <Link
            href={`/trades/${playerId}/${t.id}`}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-foreground/5"
          >
            <span className="flex items-baseline gap-2">
              <span className="font-semibold">{TYPE_LABELS[t.type]}</span>
              {t.symbol && <span className="font-mono">{t.symbol}</span>}
              {t.shares && <span className="text-foreground/60">× {t.shares}</span>}
              <span className="ml-auto tabular-nums">{signedAmount(t.type, t.amountCents)}</span>
            </span>
            <span className="flex gap-2 text-xs text-foreground/50">
              <span>{formatDay(t.date)}</span>
              {t.note && <span className="min-w-0 flex-1 truncate">· {t.note}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

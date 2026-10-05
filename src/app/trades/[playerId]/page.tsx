import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/app/_components/ui";
import { parseId } from "@/lib/db/errors";
import { getDb } from "@/lib/db/postgres";
import { listInstruments } from "@/lib/instruments";
import { formatEuroCents } from "@/lib/money";
import { getPlayer, listPlayers } from "@/lib/players";
import { berlinToday, listTransactions, position } from "@/lib/transactions";
import { addTransactionAction } from "../actions";
import { signedAmount, TYPE_LABELS } from "../format";
import { TransactionForm } from "../transaction-forms";

export const metadata: Metadata = { title: "Trades · Stock League" };

export default async function PlayerTradesPage({ params }: PageProps<"/trades/[playerId]">) {
  const id = parseId((await params).playerId);
  const db = getDb();
  const player = id === null ? null : await getPlayer(db, id);
  if (!player) notFound();

  const [transactions, instruments, players] = await Promise.all([
    listTransactions(db, player.id),
    listInstruments(db),
    listPlayers(db),
  ]);
  const { cashCents, holdings } = position(transactions);
  const names = new Map(instruments.map((i) => [i.symbol, i.name]));

  return (
    <Page title={`${player.emoji ?? "🙂"} ${player.name}`} back={{ href: "/trades", label: "Trades" }}>
      <section className="flex flex-col gap-3 rounded-2xl border border-foreground/15 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm uppercase tracking-wide text-foreground/60">Cash</span>
          <span className="text-2xl font-semibold tabular-nums">{formatEuroCents(cashCents)}</span>
        </div>
        {holdings.length === 0 ? (
          <p className="text-sm text-foreground/60">No holdings yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {holdings.map((h) => (
              <li key={h.symbol} className="flex items-baseline gap-3">
                <span className="font-mono font-semibold">{h.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground/60">
                  {names.get(h.symbol)}
                </span>
                <span className="tabular-nums">{h.shares}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Add a transaction</h2>
        <TransactionForm
          action={addTransactionAction.bind(null, player.id)}
          defaults={{
            date: berlinToday(),
            type: "buy",
            instrumentId: "",
            shares: "",
            amount: "",
            note: "",
            by: player.name,
          }}
          instruments={instruments}
          players={players.map((p) => p.name)}
          submitLabel="Add transaction"
          pendingLabel="Checking and saving…"
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">History</h2>
        {transactions.length === 0 ? (
          <p className="text-foreground/60">Nothing entered yet.</p>
        ) : (
          <ul className="divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
            {transactions.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/trades/${player.id}/${t.id}`}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-foreground/5"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-semibold">{TYPE_LABELS[t.type]}</span>
                    {t.symbol && <span className="font-mono">{t.symbol}</span>}
                    {t.shares && <span className="text-foreground/60">× {t.shares}</span>}
                    <span className="ml-auto tabular-nums">{signedAmount(t.type, t.amountCents)}</span>
                  </span>
                  <span className="flex gap-2 text-xs text-foreground/50">
                    <span>{t.date}</span>
                    {t.note && <span className="min-w-0 flex-1 truncate">· {t.note}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

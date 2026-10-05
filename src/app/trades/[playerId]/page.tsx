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
import { TransactionHistory } from "../history";
import { TransactionForm } from "../transaction-forms";

export async function generateMetadata({ params }: PageProps<"/trades/[playerId]">): Promise<Metadata> {
  const id = parseId((await params).playerId);
  const player = id === null ? null : await getPlayer(getDb(), id);
  return { title: `${player ? `${player.name}'s trades` : "Not found"} · Stock League` };
}

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
        <Link href={`/portfolio/${player.id}`} className="text-sm underline">
          See how {player.name} is doing →
        </Link>
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
        <TransactionHistory playerId={player.id} transactions={transactions} />
      </section>
    </Page>
  );
}

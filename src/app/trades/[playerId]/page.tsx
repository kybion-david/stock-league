import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/app/_components/ui";
import { parseId } from "@/lib/db/errors";
import { getDb } from "@/lib/db/postgres";
import { listInstruments } from "@/lib/instruments";
import { formatDay } from "@/lib/leaderboard";
import { latestManualValues } from "@/lib/manual";
import { formatEuroCents } from "@/lib/money";
import { getPlayer, listPlayers } from "@/lib/players";
import { berlinToday, listTransactions, position } from "@/lib/transactions";
import { eurCents } from "@/lib/valuation";
import { addTransactionAction, setManualValueAction } from "../actions";
import { TransactionHistory } from "../history";
import { ManualValueForm } from "../manual-value-form";
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

  const [transactions, instruments, players, manualValues] = await Promise.all([
    listTransactions(db, player.id),
    listInstruments(db),
    listPlayers(db),
    latestManualValues(db),
  ]);
  const { cashCents, holdings } = position(transactions);
  const today = berlinToday();
  const bySymbol = new Map(instruments.map((i) => [i.symbol, i]));

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
            {holdings.map((h) => {
              const instrument = bySymbol.get(h.symbol);
              const manual = instrument?.type === "manual" ? manualValues.get(h.symbol) : null;
              return (
                <li key={h.symbol} className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono font-semibold">{h.symbol}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground/60">
                      {instrument?.name}
                    </span>
                    <span className="tabular-nums">{h.shares}</span>
                  </div>
                  {instrument?.type === "manual" && (
                    <div className="mb-2 flex flex-col gap-2 rounded-xl bg-foreground/5 p-3">
                      <p className="text-sm text-foreground/70">
                        ✍️{" "}
                        {manual
                          ? `Worth ${formatEuroCents(eurCents(h.shares, manual.close))} on ${formatDay(manual.date)}, as last entered.`
                          : "No value entered yet, so it counts at what it cost."}{" "}
                        Keep it up to date: nobody else will.
                      </p>
                      <ManualValueForm
                        action={setManualValueAction.bind(null, player.id)}
                        instrumentId={instrument.id}
                        symbol={h.symbol}
                        today={today}
                      />
                    </div>
                  )}
                </li>
              );
            })}
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
          today={today}
          defaults={{
            date: today,
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

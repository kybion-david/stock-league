import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/app/_components/ui";
import { getDb } from "@/lib/db/postgres";
import { listInstruments } from "@/lib/instruments";
import { addInstrumentAction } from "./actions";
import { AddInstrumentForm } from "./instrument-forms";

export const metadata: Metadata = { title: "Instruments · Stock League" };

const TYPE_LABELS = { stock: "Stock", etf: "ETF", crypto: "Crypto" } as const;

export default async function InstrumentsPage() {
  const instruments = await listInstruments(getDb());

  return (
    <Page title="Instruments">
      <p className="text-foreground/70">
        Stocks, ETFs and crypto that players can trade. Add one before entering a
        trade in it.
      </p>
      {instruments.length === 0 ? (
        <p className="text-foreground/60">No instruments yet.</p>
      ) : (
        <ul className="divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
          {instruments.map((i) => (
            <li key={i.id}>
              <Link
                href={`/instruments/${i.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-foreground/5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-semibold">{i.symbol}</p>
                  <p className="truncate text-sm text-foreground/60">{i.name}</p>
                </div>
                <div className="shrink-0 text-right text-sm text-foreground/60">
                  <p>{TYPE_LABELS[i.type]}</p>
                  <p className="font-mono">{i.currency}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Add an instrument</h2>
        <AddInstrumentForm action={addInstrumentAction} />
      </section>
    </Page>
  );
}

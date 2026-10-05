import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ValueChart } from "@/app/chart/value-chart";
import { AWARDS, Change, tone } from "@/app/_components/score";
import { Page } from "@/app/_components/ui";
import { signedAmount, TYPE_LABELS } from "@/app/trades/format";
import { parseId } from "@/lib/db/errors";
import { getDb } from "@/lib/db/postgres";
import { formatDay, priceNote } from "@/lib/leaderboard";
import { STARTING_CASH_CENTS } from "@/lib/ledger";
import { formatEuroCents, formatSignedEuroCents, formatSignedPercent } from "@/lib/money";
import { formatPlace, portfolio, type HoldingRow, type Portfolio } from "@/lib/portfolio";
import { GAME_START_DATE } from "@/lib/valuation";

export const metadata: Metadata = { title: "Player · Stock League" };

const percent = new Intl.NumberFormat("en-IE", { style: "percent", maximumFractionDigits: 0 });

export default async function PortfolioPage({ params }: PageProps<"/portfolio/[id]">) {
  const id = parseId((await params).id);
  const p = id === null ? null : await portfolio(getDb(), id);
  if (!p) notFound();
  const { row, started } = p;
  const note = priceNote(row.holdings);

  return (
    <Page title={`${row.player.emoji ?? "🙂"} ${row.player.name}`}>
      <section className="flex flex-col gap-2 rounded-2xl border border-foreground/15 p-4">
        <p className="text-sm text-foreground/60">
          {started
            ? `${placeLabel(p)} · prices from ${formatDay(p.date)}`
            : `Kick-off ${formatDay(GAME_START_DATE)}`}
        </p>
        <p className="text-4xl font-bold tabular-nums">{formatEuroCents(row.valueCents)}</p>
        {started && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Change label="Total" cents={row.returnCents} rate={row.returnRate} />
            <Change label="Day" cents={row.dayChangeCents} rate={row.dayChangeRate} />
          </div>
        )}
        {note && <p className="text-xs text-foreground/50">⏳ {note}</p>}
      </section>

      <dl className="grid grid-cols-2 gap-3">
        <Stat label="Cash" value={formatEuroCents(row.cashCents)} />
        <Stat label="Invested" value={formatEuroCents(row.holdingsValueCents)} />
        <Stat label="Fees paid" value={formatEuroCents(row.feesCents)} />
        <Stat label="Dividends" value={formatEuroCents(row.dividendsCents)} />
        <Stat
          label="Booked by selling"
          value={formatSignedEuroCents(p.realizedCents)}
          className={`col-span-2 ${tone(p.realizedCents)}`}
        />
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Holdings</h2>
        {p.holdings.length === 0 ? (
          <p className="text-foreground/60">All cash, no holdings.</p>
        ) : (
          <ul className="divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
            {p.holdings.map((h) => (
              <Holding key={h.instrument} h={h} />
            ))}
          </ul>
        )}
        {p.closed.length > 0 && (
          <>
            <h3 className="font-semibold">Sold out of</h3>
            <ul className="flex flex-col gap-1">
              {p.closed.map((c) => (
                <li key={c.instrument} className="flex items-baseline gap-2">
                  <span className="font-mono font-semibold">{c.instrument}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground/60">{c.name}</span>
                  <span className={`shrink-0 tabular-nums ${tone(c.realizedCents)}`}>
                    {formatSignedEuroCents(c.realizedCents)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Over the game</h2>
        {p.series.length === 0 ? (
          <p className="text-foreground/60">
            The chart starts with the first prices, after the US close on{" "}
            {formatDay(GAME_START_DATE)}.
          </p>
        ) : (
          <ValueChart
            dates={p.series.map((s) => s.date)}
            dayLabels={p.series.map((s) => formatDay(s.date))}
            baselineCents={STARTING_CASH_CENTS}
            series={[
              {
                id: row.player.id,
                name: row.player.name,
                emoji: row.player.emoji,
                values: p.series.map((s) => s.valueCents),
                stale: p.series.map((s) => s.stale),
              },
            ]}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold">History</h2>
          <Link href={`/trades/${row.player.id}`} className="text-sm underline">
            ✍️ Enter trades
          </Link>
        </div>
        {p.transactions.length === 0 ? (
          <p className="text-foreground/60">Nothing entered yet.</p>
        ) : (
          <ul className="divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
            {p.transactions.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/trades/${row.player.id}/${t.id}`}
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
        )}
      </section>
    </Page>
  );
}

function placeLabel({ row, playerCount }: Portfolio): string {
  const place = formatPlace(row.place, playerCount);
  return row.award ? `${AWARDS[row.award].emoji} ${place}` : place;
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border border-foreground/15 p-3 ${className}`}>
      <dt className="text-xs uppercase tracking-wide text-foreground/60">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Holding({ h }: { h: HoldingRow }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="font-mono font-semibold">{h.instrument}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground/60">{h.name}</span>
        <span className="shrink-0 font-semibold tabular-nums">{formatEuroCents(h.valueCents)}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="text-foreground/60 tabular-nums">
          {h.shares} {h.shares === "1" ? "share" : "shares"} · cost {formatEuroCents(h.costCents)}
          {h.weight !== null && ` · ${percent.format(h.weight)} of value`}
        </span>
        <span className={`ml-auto tabular-nums ${tone(h.gainCents)}`}>
          {formatSignedEuroCents(h.gainCents)}
          {h.costCents > 0 && ` (${formatSignedPercent(h.gainRate)})`}
        </span>
      </div>
      {h.note && <p className="text-xs text-foreground/50">⏳ {h.note}</p>}
    </li>
  );
}

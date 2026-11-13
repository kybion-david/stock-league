import Link from "next/link";
import { Fragment } from "react";
import { BENCHMARK, versusMarket, type BenchmarkStanding } from "@/lib/benchmark";
import { getDb } from "@/lib/db/postgres";
import { AWARDS, Change } from "@/app/_components/score";
import {
  daysBetween,
  formatDay,
  leaderboard,
  priceNote,
  type LeaderboardRow,
} from "@/lib/leaderboard";
import { formatEuroCents } from "@/lib/money";
import { berlinToday } from "@/lib/transactions";
import { GAME_START_DATE } from "@/lib/valuation";

const STAKE_CENTS = 100_000;

export default async function Home() {
  const today = berlinToday();
  const board = await leaderboard(getDb(), today);
  // The market sits below every player worth as much or more.
  const marketValue = board.benchmark?.valueCents;
  const marketAt =
    marketValue === undefined
      ? -1
      : board.rows.filter((r) => r.valueCents >= marketValue).length;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">📈 Stock League</h1>
        {board.started && (
          <p className="text-sm text-foreground/60">
            {board.lastUpdated
              ? `Prices from ${formatDay(board.lastUpdated)}. Updated daily after the US close.`
              : "The game is on! First prices tonight after the US close."}
          </p>
        )}
      </header>

      {!board.started && <KickOff today={today} />}

      {board.rows.length === 0 ? (
        <p className="text-foreground/60">
          No players yet.{" "}
          <Link href="/players" className="underline">
            Add them
          </Link>
          .
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          {!board.started && <h2 className="text-lg font-semibold">Line-up</h2>}
          <ol className="divide-y divide-foreground/10 overflow-hidden rounded-2xl border border-foreground/15">
            {board.rows.map((row, i) => (
              <Fragment key={row.player.id}>
                {board.benchmark && i === marketAt && <MarketRow market={board.benchmark} />}
                <Row row={row} started={board.started} market={board.benchmark} />
              </Fragment>
            ))}
            {board.benchmark && marketAt === board.rows.length && (
              <MarketRow market={board.benchmark} />
            )}
          </ol>
        </section>
      )}

      <nav className="grid grid-cols-2 gap-3">
        <Link
          href="/trades"
          className="col-span-2 rounded-2xl bg-foreground p-4 font-semibold text-background hover:opacity-90"
        >
          ✍️ Enter trades
        </Link>
        <Link
          href="/chart"
          className="rounded-2xl border border-foreground/15 p-4 font-semibold hover:bg-foreground/5"
        >
          📈 The race
        </Link>
        <Link
          href="/stats"
          className="rounded-2xl border border-foreground/15 p-4 font-semibold hover:bg-foreground/5"
        >
          🎲 Fun stats
        </Link>
        <Link
          href="/strategies"
          className="col-span-2 rounded-2xl border border-foreground/15 p-4 font-semibold hover:bg-foreground/5"
        >
          💬 Strategies
        </Link>
        <Link
          href="/players"
          className="rounded-2xl border border-foreground/15 p-4 font-semibold hover:bg-foreground/5"
        >
          👥 Players
        </Link>
        <Link
          href="/instruments"
          className="rounded-2xl border border-foreground/15 p-4 font-semibold hover:bg-foreground/5"
        >
          📊 Instruments
        </Link>
      </nav>
    </main>
  );
}

function KickOff({ today }: { today: string }) {
  const days = daysBetween(today, GAME_START_DATE);
  return (
    <>
      <p className="text-lg leading-relaxed text-foreground/80">
        Each player gets {formatEuroCents(STAKE_CENTS)}. Whoever has the most when the game
        ends wins.
      </p>
      <div className="rounded-2xl border border-foreground/15 p-4">
        <p className="text-sm uppercase tracking-wide text-foreground/60">Kick-off</p>
        <p className="text-xl font-semibold">
          {formatDay(GAME_START_DATE)} 2026 · {days === 1 ? "tomorrow" : `${days} days to go`}
        </p>
      </div>
    </>
  );
}

function Row({
  row,
  started,
  market,
}: {
  row: LeaderboardRow;
  started: boolean;
  market: BenchmarkStanding | null;
}) {
  const award = row.award ? AWARDS[row.award] : null;
  const note = priceNote(row.holdings);
  const vs = market && versusMarket(row.valueCents, market);
  return (
    <li className={row.award === "gold" ? "bg-amber-400/10" : undefined}>
      <Link
        href={`/portfolio/${row.player.id}`}
        className="flex flex-col gap-2 px-4 py-3 hover:bg-foreground/5"
      >
        <div className="flex items-center gap-3">
          {started && (
            <span
              className="w-8 shrink-0 text-center text-2xl font-semibold tabular-nums text-foreground/60"
              role="img"
              aria-label={award ? award.label : `Place ${row.place}`}
            >
              {award ? award.emoji : row.place}
            </span>
          )}
          <span className="shrink-0 text-2xl" aria-hidden>
            {row.player.emoji ?? "🙂"}
          </span>
          <span className="min-w-0 flex-1 truncate text-lg font-semibold">{row.player.name}</span>
          <span className="shrink-0 text-lg font-semibold tabular-nums">
            {formatEuroCents(row.valueCents)}
          </span>
          <span className="-ml-1 shrink-0 text-foreground/40" aria-hidden>
            ›
          </span>
        </div>
        {started && (
          <div className="flex flex-wrap gap-2 pl-11 text-sm">
            <Change label="Total" cents={row.returnCents} rate={row.returnRate} />
            <Change label="Day" cents={row.dayChangeCents} rate={row.dayChangeRate} />
            {vs && <Change label={`vs ${BENCHMARK.emoji}`} cents={vs.cents} rate={vs.rate} />}
          </div>
        )}
        {note && <p className="pl-11 text-xs text-foreground/50">⏳ {note}</p>}
      </Link>
    </li>
  );
}

/** The 70/30 market benchmark (ADR 025): ranked by value, but not a player. */
function MarketRow({ market }: { market: BenchmarkStanding }) {
  const note = priceNote(market.holdings);
  return (
    <li
      className="flex flex-col gap-2 border-dashed border-foreground/30 bg-foreground/[0.03] px-4 py-3 [&:not(:first-child)]:border-t-2"
      aria-label={`${BENCHMARK.name}: ${BENCHMARK.description}`}
    >
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0" aria-hidden />
        <span className="shrink-0 text-2xl" aria-hidden>
          {BENCHMARK.emoji}
        </span>
        <span className="min-w-0 flex-1 truncate text-lg font-semibold italic text-foreground/80">
          {BENCHMARK.name}
        </span>
        <span className="shrink-0 text-lg font-semibold tabular-nums text-foreground/80">
          {formatEuroCents(market.valueCents)}
        </span>
        <span className="-ml-1 shrink-0 text-transparent" aria-hidden>
          ›
        </span>
      </div>
      <div className="flex flex-wrap gap-2 pl-11 text-sm">
        <Change label="Total" cents={market.returnCents} rate={market.returnRate} />
        <Change label="Day" cents={market.dayChangeCents} rate={market.dayChangeRate} />
      </div>
      <p className="pl-11 text-xs text-foreground/50">
        {formatEuroCents(STAKE_CENTS)} put in {BENCHMARK.description} at kick-off. Not a player.
      </p>
      {note && <p className="pl-11 text-xs text-foreground/50">⏳ {note}</p>}
    </li>
  );
}

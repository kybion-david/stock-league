import Link from "next/link";
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
            {board.rows.map((row) => (
              <Row key={row.player.id} row={row} started={board.started} />
            ))}
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
          className="col-span-2 rounded-2xl border border-foreground/15 p-4 font-semibold hover:bg-foreground/5"
        >
          📈 The race: value over time
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

function Row({ row, started }: { row: LeaderboardRow; started: boolean }) {
  const award = row.award ? AWARDS[row.award] : null;
  const note = priceNote(row.holdings);
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
        </div>
        {started && (
          <div className="flex flex-wrap gap-2 pl-11 text-sm">
            <Change label="Total" cents={row.returnCents} rate={row.returnRate} />
            <Change label="Day" cents={row.dayChangeCents} rate={row.dayChangeRate} />
          </div>
        )}
        {note && <p className="pl-11 text-xs text-foreground/50">⏳ {note}</p>}
      </Link>
    </li>
  );
}

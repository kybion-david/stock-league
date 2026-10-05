import Link from "next/link";
import { formatEuroCents } from "@/lib/money";

const STAKE_CENTS = 100_000;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="text-5xl" aria-hidden>
        📈
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Stock League</h1>
      <p className="text-lg leading-relaxed text-foreground/80">
        Each player gets {formatEuroCents(STAKE_CENTS)}. Whoever has the most
        when the game ends wins.
      </p>
      <div className="rounded-2xl border border-foreground/15 p-4">
        <p className="text-sm uppercase tracking-wide text-foreground/60">
          Kick-off
        </p>
        <p className="text-xl font-semibold">1 November 2026</p>
      </div>
      <p className="text-sm text-foreground/60">
        The leaderboard shows up here once the game starts.
      </p>
      <nav className="grid grid-cols-2 gap-3">
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

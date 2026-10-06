import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/app/_components/ui";
import { getDb } from "@/lib/db/postgres";
import { DEMO, DEMO_TODAY } from "@/lib/demo/config";
import { DEMO_PLAYERS } from "@/lib/demo/season";
import { formatDay } from "@/lib/leaderboard";
import { listPlayers } from "@/lib/players";
import { GAME_START_DATE } from "@/lib/valuation";

export const metadata: Metadata = { title: "Demo season · Stock League" };

export default async function DemoPage() {
  if (!DEMO) notFound();
  const ids = new Map((await listPlayers(getDb())).map((p) => [p.name, p.id]));

  return (
    <Page title="🧪 Demo season">
      <div className="flex flex-col gap-3 text-foreground/80">
        <p>
          This is a made-up season to show what the game will look like. The site pretends
          today is <strong>{formatDay(DEMO_TODAY)} {DEMO_TODAY.slice(0, 4)}</strong>, three months
          after kick-off on {formatDay(GAME_START_DATE)} 2026.
        </p>
        <p>
          Players, trades and prices are all fake. Prices are a random walk with a few big moves
          (a GameStop squeeze in December, a crypto crash in November, a Bitcoin rally in
          January). The real database isn&apos;t used or changed.
        </p>
        <p>
          Go ahead and click around: enter trades, add players. Changes are kept in memory only and
          disappear when the server restarts (after it has been idle for a while).
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">The cast</h2>
        <ul className="divide-y divide-foreground/10 overflow-hidden rounded-2xl border border-foreground/15">
          {DEMO_PLAYERS.map((p) => {
            const id = ids.get(p.name);
            const body = (
              <div className="flex gap-3 px-4 py-3">
                <span className="text-2xl" aria-hidden>
                  {p.emoji}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold">
                    {p.name} · <span className="font-normal text-foreground/60">{p.trait}</span>
                  </span>
                  <span className="text-sm text-foreground/70">{p.style}</span>
                </div>
              </div>
            );
            return (
              <li key={p.name}>
                {id ? (
                  <Link href={`/portfolio/${id}`} className="block hover:bg-foreground/5">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-sm text-foreground/60">
        Demo mode is switched on in the code (ADR 021). Reverting the pull request that added it
        brings back the real, empty game.
      </p>
    </Page>
  );
}

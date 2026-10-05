import { Page } from "@/app/_components/ui";
import { getDb } from "@/lib/db/postgres";
import { formatDay } from "@/lib/leaderboard";
import { formatEuroCents, formatSignedEuroCents, formatSignedPercent } from "@/lib/money";
import type { Player } from "@/lib/players";
import { funStats, type PickMove, type PickResult, type PlayerDay } from "@/lib/stats";
import { GAME_START_DATE } from "@/lib/valuation";

export default async function StatsPage() {
  const stats = await funStats(getDb());

  if (!stats.started) {
    return (
      <Page title="🎲 Fun stats">
        <p className="text-foreground/60">
          Stats start once the game does, on {formatDay(GAME_START_DATE)} 2026.
        </p>
      </Page>
    );
  }

  const records = stats.days >= 2;
  return (
    <Page title="🎲 Fun stats">
      <p className="-mt-4 text-sm text-foreground/60">
        As of {formatDay(stats.date)}, day {stats.days} of the game.
      </p>

      <Section title="Today">
        <Stat emoji="🚀" title="Top gainer">
          <PlayerDayLine day={stats.topGainer} empty="Nobody went up." />
        </Stat>
        <Stat emoji="🪂" title="Biggest loser">
          <PlayerDayLine day={stats.topLoser} empty="Nobody went down." />
        </Stat>
        <Stat emoji="🔥" title="Hottest pick">
          <PickMoveLine move={stats.hotPick} empty="No pick went up." />
        </Stat>
        <Stat emoji="🧊" title="Coldest pick">
          <PickMoveLine move={stats.coldPick} empty="No pick went down." />
        </Stat>
      </Section>

      <Section title="Records">
        <Stat emoji="🏆" title="Best single day">
          <PlayerDayLine
            day={stats.bestDay}
            showDate
            empty={records ? "No up days yet." : "From day 2."}
          />
        </Stat>
        <Stat emoji="💥" title="Worst single day">
          <PlayerDayLine
            day={stats.worstDay}
            showDate
            empty={records ? "No down days yet." : "From day 2."}
          />
        </Stat>
        <Stat emoji="💎" title="Best pick of the game">
          <PickResultLine pick={stats.bestPick} empty="No pick is up yet." />
        </Stat>
        <Stat emoji="🍋" title="Worst pick of the game">
          <PickResultLine pick={stats.worstPick} empty="No pick is down yet." />
        </Stat>
        <Stat emoji="💸" title="Fee champion">
          {stats.mostFees ? (
            <Line
              who={stats.mostFees.players.map(playerName).join(" & ")}
              detail={`paid ${formatEuroCents(stats.mostFees.cents)} in fees`}
            />
          ) : (
            <NotYet text="No fees paid yet." />
          )}
        </Stat>
      </Section>
    </Page>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="divide-y divide-foreground/10 overflow-hidden rounded-2xl border border-foreground/15">
        {children}
      </ul>
    </section>
  );
}

function Stat({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="shrink-0 text-2xl" aria-hidden>
        {emoji}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm text-foreground/60">{title}</span>
        {children}
      </div>
    </li>
  );
}

function playerName(player: Player): string {
  return `${player.emoji ?? "🙂"} ${player.name}`;
}

/** The stat's winner and what they did. */
function Line({ who, detail }: { who: string; detail: React.ReactNode }) {
  return (
    <p className="min-w-0">
      <span className="font-semibold">{who}</span> <span className="tabular-nums">{detail}</span>
    </p>
  );
}

function NotYet({ text }: { text: string }) {
  return <p className="text-foreground/50">n/a · {text}</p>;
}

/** A rise in green with ▲ or a fall in red with ▼: "+€1.00 (+0.10%)", or just the percent. */
function Signed({ cents, rate = null }: { cents?: number; rate?: number | null }) {
  const up = (cents ?? rate ?? 0) > 0;
  const percent = rate === null ? "" : formatSignedPercent(rate);
  const text =
    cents === undefined ? percent : `${formatSignedEuroCents(cents)}${percent && ` (${percent})`}`;
  return (
    <span
      className={`whitespace-nowrap ${up ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
    >
      {up ? "▲ " : "▼ "}
      {text}
    </span>
  );
}

function PlayerDayLine({
  day,
  showDate = false,
  empty,
}: {
  day: PlayerDay | null;
  showDate?: boolean;
  empty: string;
}) {
  if (!day) return <NotYet text={empty} />;
  return (
    <Line
      who={playerName(day.player)}
      detail={
        <>
          <Signed cents={day.cents} rate={day.rate} />
          {showDate && <span className="text-foreground/60"> on {formatDay(day.date)}</span>}
        </>
      }
    />
  );
}

function PickMoveLine({ move, empty }: { move: PickMove | null; empty: string }) {
  if (!move) return <NotYet text={empty} />;
  return (
    <>
      <Line who={move.instrument} detail={<Signed rate={move.rate} />} />
      <p className="text-xs text-foreground/50">
        Held by {move.holders.map((p) => p.name).join(", ")}
      </p>
    </>
  );
}

function PickResultLine({ pick, empty }: { pick: PickResult | null; empty: string }) {
  if (!pick) return <NotYet text={empty} />;
  return (
    <Line
      who={playerName(pick.player)}
      detail={
        <>
          <span className="text-foreground/60">with {pick.instrument} </span>
          <Signed cents={pick.cents} />
        </>
      }
    />
  );
}

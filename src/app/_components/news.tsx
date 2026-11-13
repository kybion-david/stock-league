import Link from "next/link";
import { BENCHMARK } from "@/lib/benchmark";
import { formatDay } from "@/lib/leaderboard";
import { formatEuroCents, formatSignedEuroCents, formatSignedPercent } from "@/lib/money";
import { ordinal, type DayNews, type NewsItem, type PlayerDayNews, type TradeNews, type WeekRecap } from "@/lib/news";
import { tone } from "@/app/_components/score";

/** The news feed (ADR 027): day cards and weekly recaps, newest first. */
export function NewsFeed({ items }: { items: readonly NewsItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) =>
        item.kind === "recap" ? (
          <Recap key={`recap-${item.to}`} recap={item} />
        ) : (
          <Day key={item.date} day={item} />
        ),
      )}
    </div>
  );
}

function Recap({ recap }: { recap: WeekRecap }) {
  const range =
    recap.from === recap.to
      ? formatDay(recap.to)
      : `${formatDay(recap.from)} – ${formatDay(recap.to)}`;
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-amber-400/10 p-4">
      <h3 className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="font-semibold">🗞️ Week {recap.week} recap</span>
        <span className="text-sm text-foreground/60">{range}</span>
      </h3>
      <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
        {recap.lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </article>
  );
}

function Day({ day }: { day: DayNews }) {
  return (
    <article className="flex flex-col gap-2">
      <h3 className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{formatDay(day.date)}</span>
        {day.market && (
          <span className="text-sm tabular-nums text-foreground/60">
            {BENCHMARK.emoji} Market{" "}
            <span className={tone(day.market.dayChangeCents)}>
              {day.market.dayChangeRate === null
                ? formatSignedEuroCents(day.market.dayChangeCents)
                : formatSignedPercent(day.market.dayChangeRate)}
            </span>
          </span>
        )}
      </h3>
      <ul className="divide-y divide-foreground/10 overflow-hidden rounded-2xl border border-foreground/15">
        {day.players.map((p) => (
          <PlayerLine key={p.player.id} news={p} />
        ))}
      </ul>
    </article>
  );
}

function PlayerLine({ news }: { news: PlayerDayNews }) {
  const details = [
    ...placeNote(news),
    ...news.trades.map(tradeNote),
    ...news.moves.map(
      (m) => `${m.instrument} ${m.rate > 0 ? "🔥" : "🧊"} ${formatSignedPercent(m.rate)}`,
    ),
  ];
  const quiet = news.dayChangeCents === 0 && news.trades.length === 0;
  return (
    <li>
      <Link
        href={`/portfolio/${news.player.id}`}
        className="flex flex-col gap-0.5 px-4 py-2.5 hover:bg-foreground/5"
      >
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-lg" aria-hidden>
            {news.player.emoji ?? "🙂"}
          </span>
          <span
            className={`min-w-0 flex-1 truncate font-medium ${quiet ? "text-foreground/50" : ""}`}
          >
            {news.player.name}
          </span>
          <span className={`shrink-0 text-sm tabular-nums ${tone(news.dayChangeCents)}`}>
            {news.dayChangeCents > 0 ? "▲ " : news.dayChangeCents < 0 ? "▼ " : ""}
            {formatSignedEuroCents(news.dayChangeCents)}
            {news.dayChangeRate !== null && ` (${formatSignedPercent(news.dayChangeRate)})`}
          </span>
        </div>
        {details.length > 0 && (
          <p className="pl-7 text-xs leading-relaxed text-foreground/60">{details.join(" · ")}</p>
        )}
      </Link>
    </li>
  );
}

function placeNote({ placeChange, place }: PlayerDayNews): string[] {
  if (!placeChange) return [];
  return placeChange > 0
    ? [`⬆️ up ${placeChange} to ${ordinal(place)}`]
    : [`⬇️ down ${-placeChange} to ${ordinal(place)}`];
}

function tradeNote(trade: TradeNews): string {
  const amount = formatEuroCents(trade.amountCents);
  switch (trade.type) {
    case "buy":
      return `🛒 bought ${trade.instrument} for ${amount}`;
    case "sell":
      return `💸 sold ${trade.instrument} for ${amount}`;
    case "dividend":
      return `🎁 ${amount} dividend${trade.instrument ? ` from ${trade.instrument}` : ""}`;
    case "fee":
      return `🧾 ${amount} fee`;
  }
}

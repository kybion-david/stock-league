// News (ADR 027): the home page's feed under the leaderboard. Per game day,
// every player's movement (value change, places won or lost, trades, and
// holdings that jumped or sank), and once a week, after Friday's prices,
// a cheeky written recap of the week. Everything is worked out from the
// stored ledger and snapshots when the page loads, so there's no job or
// table to keep in step: the recap appears as soon as the daily job has
// stored Friday's prices. Built on valuation (ADR 014) and the market
// benchmark (ADR 025).
import { benchmarkLedger } from "@/lib/benchmark";
import type { Db } from "@/lib/db/db";
import { addDays } from "@/lib/ingest";
import { leaderboardDate } from "@/lib/leaderboard";
import type { TransactionType } from "@/lib/ledger";
import { formatEuroCents, formatSignedEuroCents, formatSignedPercent } from "@/lib/money";
import type { Player } from "@/lib/players";
import { eurPrice } from "@/lib/stats";
import { berlinToday } from "@/lib/transactions";
import {
  dayChange,
  GAME_START_DATE,
  latestSnapshotDate,
  loadGame,
  valuePlayer,
  type DayChange,
  type GameData,
  type PlayerValuation,
} from "@/lib/valuation";

/** A holding counts as news when its EUR price moved at least this much in a day. */
export const BIG_MOVE_RATE = 0.03;
/** At most this many big moves per player and day, biggest first. */
const MAX_MOVES = 2;

export interface TradeNews {
  type: TransactionType;
  /** Instrument name for people; null for a fee without one. */
  instrument: string | null;
  amountCents: number;
}

export interface MoveNews {
  instrument: string;
  /** EUR price change since the day before, e.g. 0.05 for +5%. */
  rate: number;
}

export interface PlayerDayNews extends DayChange {
  player: Player;
  valueCents: number;
  place: number;
  /** Places gained (positive) or lost since the day before; null while everyone was level. */
  placeChange: number | null;
  trades: TradeNews[];
  moves: MoveNews[];
}

export interface DayNews {
  kind: "day";
  date: string;
  /** Everyone, biggest gain first (ties by name). */
  players: PlayerDayNews[];
  /** The 🌍 market's day; null before it has prices. */
  market: DayChange | null;
}

export interface WeekRecap {
  kind: "recap";
  /** First and last day of the week covered (the last is a Friday). */
  from: string;
  to: string;
  /** 1 for the week that ends on the first Friday of the game. */
  week: number;
  lines: string[];
}

export type NewsItem = DayNews | WeekRecap;

export interface News {
  /** The leaderboard's day: the newest day in the feed. */
  date: string;
  started: boolean;
  /** Newest first; a week's recap comes just before its Friday. */
  items: NewsItem[];
}

/** One day's values and places for everyone, plus the market's value. */
interface Snapshot {
  values: Map<number, PlayerValuation>;
  places: Map<number, number>;
  market: number | null;
}

const byName = (a: Player, b: Player) => a.name.localeCompare(b.name);

/** Places for values, highest first; equal values share a place (1, 1, 3). */
export function places(values: ReadonlyMap<number, number>): Map<number, number> {
  const sorted = [...values.entries()].sort((a, b) => b[1] - a[1]);
  const result = new Map<number, number>();
  sorted.forEach(([id, value], index) => {
    const tied = index > 0 && sorted[index - 1][1] === value;
    result.set(id, tied ? result.get(sorted[index - 1][0])! : index + 1);
  });
  return result;
}

/** "1st", "2nd", "3rd", "4th", … */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** The day of the week, 0 = Sunday … 5 = Friday. */
function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * The whole feed from the first game day to `to`, newest first. `names`
 * maps instrument keys (symbols) to names for people. A day shows when
 * anyone's value moved or anyone traded.
 */
export function buildNews(
  game: GameData,
  to: string,
  names: ReadonlyMap<string, string> = new Map(),
): NewsItem[] {
  if (to < GAME_START_DATE) return [];
  const { players, ledgers, book } = game;
  const market = benchmarkLedger(book);
  const label = (key: string) => names.get(key) ?? key;

  const snapshots = new Map<string, Snapshot>();
  const snapshot = (date: string): Snapshot => {
    const cached = snapshots.get(date);
    if (cached) return cached;
    const values = new Map(
      players.map((p) => [p.id, valuePlayer(ledgers.get(p.id) ?? [], date, book)]),
    );
    const result = {
      values,
      places: places(new Map([...values].map(([id, v]) => [id, v.valueCents]))),
      market: market ? valuePlayer(market, date, book).valueCents : null,
    };
    snapshots.set(date, result);
    return result;
  };

  const items: NewsItem[] = [];
  let week = 0;
  for (let date = GAME_START_DATE; date <= to; date = addDays(date, 1)) {
    const day = dayNews(game, date, snapshot(addDays(date, -1)), snapshot(date), label);
    if (day.players.some((p) => p.dayChangeCents !== 0 || p.trades.length > 0)) items.push(day);
    if (weekday(date) === 5) {
      week += 1;
      const from = week === 1 ? GAME_START_DATE : addDays(date, -6);
      items.push(weekRecap(game, from, date, week, snapshot, label));
    }
  }
  return items.reverse();
}

function dayNews(
  { players, ledgers, book }: GameData,
  date: string,
  before: Snapshot,
  today: Snapshot,
  label: (key: string) => string,
): DayNews {
  // Places only mean something once someone is ahead of someone.
  const level = [...before.places.values()].every((place) => place === 1);
  const rows = players.map((player): PlayerDayNews => {
    const value = today.values.get(player.id)!;
    const trades = (ledgers.get(player.id) ?? [])
      .filter((tx) => tx.date === date)
      .map((tx) => ({
        type: tx.type,
        instrument: tx.instrumentId ? label(tx.instrumentId) : null,
        amountCents: tx.amountCents,
      }));
    const moves = value.holdings
      .filter((h) => !h.manual && h.priceDate === date)
      .flatMap((h) => {
        const now = eurPrice(book, h.instrument, date);
        const then = eurPrice(book, h.instrument, addDays(date, -1));
        if (now === null || then === null || then <= 0) return [];
        const rate = now / then - 1;
        return Math.abs(rate) >= BIG_MOVE_RATE ? [{ instrument: label(h.instrument), rate }] : [];
      })
      .sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate))
      .slice(0, MAX_MOVES);
    const place = today.places.get(player.id)!;
    return {
      player,
      valueCents: value.valueCents,
      ...dayChange(value.valueCents, before.values.get(player.id)!.valueCents),
      place,
      placeChange: level ? null : before.places.get(player.id)! - place,
      trades,
      moves,
    };
  });
  rows.sort((a, b) => b.dayChangeCents - a.dayChangeCents || byName(a.player, b.player));
  return {
    kind: "day",
    date,
    players: rows,
    market:
      today.market === null || before.market === null
        ? null
        : dayChange(today.market, before.market),
  };
}

// --- The weekly recap ---

/** What happened to one player over a week, for the recap's lines. */
export interface PlayerWeek {
  player: Player;
  startCents: number;
  endCents: number;
  startPlace: number;
  endPlace: number;
  trades: number;
  feesCents: number;
  /** True if they hold anything at the end of the week. */
  invested: boolean;
}

/** An instrument's EUR price change over the week, with who holds it at the end. */
export interface PickWeek {
  instrument: string;
  rate: number;
  holders: Player[];
}

export interface WeekFacts {
  week: number;
  players: PlayerWeek[];
  /** The 🌍 market's change over the week as a rate; null before it has prices. */
  marketRate: number | null;
  /** Instruments held at the end of the week, with a price at both ends. */
  picks: PickWeek[];
}

function weekRecap(
  game: GameData,
  from: string,
  to: string,
  week: number,
  snapshot: (date: string) => Snapshot,
  label: (key: string) => string,
): WeekRecap {
  const start = snapshot(addDays(from, -1));
  const end = snapshot(to);
  const players = game.players.map((player): PlayerWeek => {
    const inWeek = (game.ledgers.get(player.id) ?? []).filter(
      (tx) => tx.date >= from && tx.date <= to,
    );
    return {
      player,
      startCents: start.values.get(player.id)!.valueCents,
      endCents: end.values.get(player.id)!.valueCents,
      startPlace: start.places.get(player.id)!,
      endPlace: end.places.get(player.id)!,
      trades: inWeek.filter((tx) => tx.type === "buy" || tx.type === "sell").length,
      feesCents: inWeek.filter((tx) => tx.type === "fee").reduce((s, tx) => s + tx.amountCents, 0),
      invested: end.values.get(player.id)!.holdings.length > 0,
    };
  });

  const holders = new Map<string, Player[]>();
  for (const p of game.players) {
    for (const h of end.values.get(p.id)!.holdings) {
      if (h.manual) continue;
      holders.set(h.instrument, [...(holders.get(h.instrument) ?? []), p]);
    }
  }
  const picks: PickWeek[] = [];
  for (const [instrument, who] of holders) {
    const now = eurPrice(game.book, instrument, to);
    // Bought during the week with no price before it: count from its first one.
    let then = eurPrice(game.book, instrument, addDays(from, -1));
    for (let d = from; then === null && d <= to; d = addDays(d, 1)) {
      then = eurPrice(game.book, instrument, d);
    }
    if (now === null || then === null || then <= 0) continue;
    picks.push({ instrument: label(instrument), rate: now / then - 1, holders: who.sort(byName) });
  }

  const marketRate =
    start.market !== null && end.market !== null && start.market > 0
      ? end.market / start.market - 1
      : null;
  return { kind: "recap", from, to, week, lines: recapLines({ week, players, marketRate, picks }) };
}

/** "🦊 Alice", or "🙂 Alice" without an emoji (as on the leaderboard). */
export function who(player: Player): string {
  return `${player.emoji ?? "🙂"} ${player.name}`;
}

/** "A", "A and B", "A, B and C". */
export function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** One of `options`, the same one every time for the same week and line. */
function pick(options: readonly string[], week: number, line: number): string {
  return options[(week * 7 + line * 3) % options.length];
}

/**
 * The recap's sentences: who leads, the week's best and worst, the market,
 * the wooden spoon, places won and lost, the hottest and coldest picks, and
 * who traded too much or not at all. Meant to tease (the owner asked for a
 * bit of meanness), never more than a sentence each.
 */
export function recapLines({ week, players, marketRate, picks }: WeekFacts): string[] {
  if (players.length === 0) return ["No players, no news. Tumbleweed."];
  const lines: string[] = [];
  const first = week === 1;
  const change = (p: PlayerWeek) => p.endCents - p.startCents;
  const rate = (p: PlayerWeek) => (p.startCents > 0 ? change(p) / p.startCents : 0);
  const money = (p: PlayerWeek) =>
    `${formatSignedEuroCents(change(p))} (${formatSignedPercent(rate(p))})`;
  const ranked = [...players].sort(
    (a, b) => b.endCents - a.endCents || byName(a.player, b.player),
  );
  const leader = ranked[0];
  const everyoneLevel = ranked.every((p) => p.endCents === leader.endCents);

  if (everyoneLevel) {
    lines.push(
      pick(
        [
          "Everyone is exactly level. Riveting stuff.",
          "Nobody is ahead of anybody. A league of equals, or of the idle.",
        ],
        week,
        0,
      ),
    );
  } else {
    const total = `${formatEuroCents(leader.endCents)} (${formatSignedPercent(leader.endCents / 100_000 - 1)})`;
    const previous = [...players].sort((a, b) => a.startPlace - b.startPlace)[0];
    if (!first && leader.startPlace !== 1 && previous.player.id !== leader.player.id) {
      lines.push(
        `${who(leader.player)} snatched 1st place from ${who(previous.player)} and sits on ${total}. Savour it.`,
      );
    } else {
      lines.push(
        pick(
          [
            `${who(leader.player)} leads on ${total}. Everyone else: take notes.`,
            `${who(leader.player)} tops the table on ${total}. Insufferable, probably.`,
            `${who(leader.player)} is on top with ${total}. It won't last.`,
          ],
          week,
          0,
        ),
      );
    }
  }

  const best = [...players].filter((p) => change(p) > 0).sort((a, b) => change(b) - change(a))[0];
  if (best) {
    lines.push(
      pick(
        [
          `Best week: ${who(best.player)}, ${money(best)}. Beginner's luck, surely.`,
          `${who(best.player)} made ${money(best)}, the best week of anyone. Pure skill, apparently.`,
          `${who(best.player)} won the week with ${money(best)}. Don't get used to it.`,
        ],
        week,
        1,
      ),
    );
  }
  const worst = [...players].filter((p) => change(p) < 0).sort((a, b) => change(a) - change(b))[0];
  if (worst) {
    lines.push(
      pick(
        [
          `${who(worst.player)} lost ${money(worst)}. Thoughts and prayers.`,
          `Ouch: ${who(worst.player)} dropped ${money(worst)} this week.`,
          `${who(worst.player)} set ${formatEuroCents(-change(worst))} on fire (${formatSignedPercent(rate(worst))}). Bold.`,
        ],
        week,
        2,
      ),
    );
  }

  if (marketRate !== null) {
    const losers = players.filter((p) => rate(p) < marketRate).map((p) => who(p.player));
    const market = `The 🌍 market did ${formatSignedPercent(marketRate)}.`;
    if (losers.length === players.length) {
      lines.push(`${market} Nobody beat a boring index fund. Embarrassing.`);
    } else if (losers.length === 0) {
      lines.push(`${market} Everyone beat it. Enjoy it, that won't happen often.`);
    } else {
      lines.push(
        `${market} ${list(losers)} ${losers.length === 1 ? "was" : "were"} beaten by a fund that doesn't even try.`,
      );
    }
  }

  const last = ranked.at(-1)!;
  if (!everyoneLevel && players.length >= 3 && last.endCents < ranked.at(-2)!.endCents) {
    const behind = formatEuroCents(leader.endCents - last.endCents);
    lines.push(
      players.length >= 4
        ? `${who(last.player)} holds the wooden spoon 🥄, ${behind} behind the top.`
        : `${who(last.player)} brings up the rear, ${behind} behind the top.`,
    );
  }

  if (!first) {
    const moved = (p: PlayerWeek) => p.startPlace - p.endPlace;
    const climber = [...players].filter((p) => moved(p) > 0).sort((a, b) => moved(b) - moved(a))[0];
    if (climber) {
      const n = moved(climber);
      lines.push(
        `${who(climber.player)} climbed ${n} ${n === 1 ? "place" : "places"} to ${ordinal(climber.endPlace)}.`,
      );
    }
    const faller = [...players].filter((p) => moved(p) < -1).sort((a, b) => moved(a) - moved(b))[0];
    if (faller) {
      lines.push(
        `${who(faller.player)} slid ${-moved(faller)} places to ${ordinal(faller.endPlace)}. Gravity works.`,
      );
    }
  }

  const holders = (p: PickWeek) => list(p.holders.map((h) => h.name));
  const hot = [...picks].filter((p) => p.rate > 0).sort((a, b) => b.rate - a.rate)[0];
  if (hot) {
    lines.push(
      `Hottest pick: ${hot.instrument}, ${formatSignedPercent(hot.rate)}. Well played, ${holders(hot)}.`,
    );
  }
  const cold = [...picks].filter((p) => p.rate < 0).sort((a, b) => a.rate - b.rate)[0];
  if (cold) {
    lines.push(
      `Coldest pick: ${cold.instrument}, ${formatSignedPercent(cold.rate)}. Sorry, ${holders(cold)}.`,
    );
  }

  const busiest = [...players].sort((a, b) => b.trades - a.trades)[0];
  if (busiest.trades >= 4) {
    lines.push(
      `${who(busiest.player)} made ${busiest.trades} trades. Somewhere a broker is buying a boat.`,
    );
  }
  const idle = players.filter((p) => !p.invested).map((p) => who(p.player));
  if (idle.length > 0) {
    lines.push(
      `${list(idle)} ${idle.length === 1 ? "is" : "are"} still sitting on cash. It's €1,000, not a mortgage.`,
    );
  } else if (!first) {
    const still = players.filter((p) => p.trades === 0).map((p) => who(p.player));
    if (still.length === players.length) {
      lines.push("Nobody traded at all. Diamond hands, or everyone forgot the password.");
    } else if (still.length > 0) {
      lines.push(
        `${list(still)} didn't touch a thing. Diamond hands, or ${still.length === 1 ? "a forgotten password" : "forgotten passwords"}?`,
      );
    }
  }

  const feeKing = [...players].sort((a, b) => b.feesCents - a.feesCents)[0];
  if (feeKing.feesCents >= 500) {
    lines.push(
      `${who(feeKing.player)} paid ${formatEuroCents(feeKing.feesCents)} in fees. The broker says thanks.`,
    );
  }
  return lines;
}

// --- Database layer ---

/** The news feed up to the leaderboard's day. `today` is the Berlin game day. */
export async function loadNews(db: Db, today = berlinToday()): Promise<News> {
  const date = leaderboardDate(await latestSnapshotDate(db), today);
  const started = date >= GAME_START_DATE;
  if (!started) return { date, started, items: [] };
  const game = await loadGame(db, date);
  const rows = await db.query<{ symbol: string; name: string }>(
    "select symbol, name from instruments",
  );
  const names = new Map(rows.map((r) => [r.symbol, r.name]));
  return { date, started, items: buildNews(game, date, names) };
}

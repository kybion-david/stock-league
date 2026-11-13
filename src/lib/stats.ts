// Fun stats (ticket 017, ADR 019): today's movers, best and worst day so
// far, best and worst pick of the game, and who paid the most fees. Built
// on valuation (ADR 014) for the same day the leaderboard shows (ADR 016).
// A stat that doesn't apply yet is null, and the page shows "n/a".
import type { Db } from "@/lib/db/db";
import { addDays } from "@/lib/ingest";
import { daysBetween, leaderboardDate } from "@/lib/leaderboard";
import type { Player } from "@/lib/players";
import { berlinToday } from "@/lib/transactions";
import {
  GAME_START_DATE,
  latestSnapshotDate,
  loadGame,
  standingsFrom,
  valueSeries,
  type PlayerSeries,
  type PlayerStanding,
  type PriceBook,
} from "@/lib/valuation";

/** A player's value change over one day. */
export interface PlayerDay {
  player: Player;
  date: string;
  cents: number;
  /** Change against the day before's value; null if that was 0 or less. */
  rate: number | null;
}

/** How one instrument's EUR price moved on the day, and who holds it. */
export interface PickMove {
  instrument: string;
  rate: number;
  holders: Player[];
}

/** A player's gain or loss on one instrument over the whole game, sold or not. */
export interface PickResult {
  player: Player;
  instrument: string;
  cents: number;
}

export interface FeeLeader {
  /** Everyone tied on the highest total, by name. */
  players: Player[];
  cents: number;
}

export interface FunStats {
  /** The day the stats are for: the leaderboard's day. */
  date: string;
  /** True once `date` is on or after the first game day. */
  started: boolean;
  /** Game days from the first one to `date`, inclusive (0 before the start). */
  days: number;
  topGainer: PlayerDay | null;
  topLoser: PlayerDay | null;
  hotPick: PickMove | null;
  coldPick: PickMove | null;
  /** Records need at least 2 game days; with 1 they'd just repeat today. */
  bestDay: PlayerDay | null;
  worstDay: PlayerDay | null;
  bestPick: PickResult | null;
  worstPick: PickResult | null;
  mostFees: FeeLeader | null;
}

const byName = (a: Player, b: Player) => a.name.localeCompare(b.name);

/**
 * The biggest rise (`sign` 1) or fall (−1) by `key`, ties broken by
 * `tieBreak`; null if nothing moved that way.
 */
function extreme<T>(
  items: readonly T[],
  key: (item: T) => number,
  sign: 1 | -1,
  tieBreak: (a: T, b: T) => number,
): T | null {
  const sorted = items
    .filter((item) => Math.sign(key(item)) === sign)
    .sort((a, b) => sign * (key(b) - key(a)) || tieBreak(a, b));
  return sorted[0] ?? null;
}

const cents = (item: { cents: number }) => item.cents;
const dayOrder = (a: PlayerDay, b: PlayerDay) =>
  a.date.localeCompare(b.date) || byName(a.player, b.player);

/** Today's biggest gainer and loser by day change in €. */
export function playerMovers(rows: readonly PlayerStanding[]): {
  topGainer: PlayerDay | null;
  topLoser: PlayerDay | null;
} {
  const days = rows.map((r) => ({
    player: r.player,
    date: r.date,
    cents: r.dayChangeCents,
    rate: r.dayChangeRate,
  }));
  return {
    topGainer: extreme(days, cents, 1, dayOrder),
    topLoser: extreme(days, cents, -1, dayOrder),
  };
}

/** Best and worst single day of any player across the series (earliest wins a tie). */
export function dayRecords(series: readonly PlayerSeries[]): {
  bestDay: PlayerDay | null;
  worstDay: PlayerDay | null;
} {
  const days = series.flatMap(({ player, points }) =>
    points.map((p) => ({ player, date: p.date, cents: p.dayChangeCents, rate: p.dayChangeRate })),
  );
  return {
    bestDay: extreme(days, cents, 1, dayOrder),
    worstDay: extreme(days, cents, -1, dayOrder),
  };
}

/**
 * Each player's result per instrument: the gain on shares still held plus
 * what sold shares made. The best must be a gain and the worst a loss.
 */
export function pickRecords(rows: readonly PlayerStanding[]): {
  bestPick: PickResult | null;
  worstPick: PickResult | null;
} {
  const picks = rows.flatMap((r) => [
    ...r.holdings.map((h) => ({
      player: r.player,
      instrument: h.instrument,
      cents: h.gainCents + h.realizedCents,
    })),
    ...r.closedPositions.map((c) => ({
      player: r.player,
      instrument: c.instrument,
      cents: c.realizedCents,
    })),
  ]);
  const order = (a: PickResult, b: PickResult) =>
    byName(a.player, b.player) || a.instrument.localeCompare(b.instrument);
  return {
    bestPick: extreme(picks, cents, 1, order),
    worstPick: extreme(picks, cents, -1, order),
  };
}

/** Whoever paid the most in fees (ties share it); null if nobody paid any. */
export function feeLeader(rows: readonly PlayerStanding[]): FeeLeader | null {
  const most = Math.max(0, ...rows.map((r) => r.feesCents));
  if (most === 0) return null;
  const players = rows.filter((r) => r.feesCents === most).map((r) => r.player);
  return { players: players.sort(byName), cents: most };
}

/** An instrument's last known price in EUR on a day, or null if unknown. */
export function eurPrice(book: PriceBook, instrument: string, date: string): number | null {
  const price = book.close(instrument, date);
  if (!price) return null;
  if (price.currency === "EUR") return Number(price.close);
  const fx = book.fx(price.currency, date);
  return fx ? Number(price.close) / Number(fx.unitsPerEur) : null;
}

/**
 * The instruments held at the end of `date` whose EUR price rose (hot) or
 * fell (cold) the most since the day before. Instruments without a price on
 * both days are left out. Floats are fine here: the rate is only shown.
 */
export function pickMovers(
  rows: readonly PlayerStanding[],
  book: PriceBook,
  date: string,
): { hotPick: PickMove | null; coldPick: PickMove | null } {
  const holders = new Map<string, Player[]>();
  for (const r of rows) {
    for (const h of r.holdings) {
      holders.set(h.instrument, [...(holders.get(h.instrument) ?? []), r.player]);
    }
  }
  const moves: PickMove[] = [];
  for (const [instrument, players] of holders) {
    const today = eurPrice(book, instrument, date);
    const before = eurPrice(book, instrument, addDays(date, -1));
    if (today === null || before === null || before <= 0) continue;
    moves.push({ instrument, rate: today / before - 1, holders: players.sort(byName) });
  }
  const rate = (m: PickMove) => m.rate;
  const order = (a: PickMove, b: PickMove) => a.instrument.localeCompare(b.instrument);
  return { hotPick: extreme(moves, rate, 1, order), coldPick: extreme(moves, rate, -1, order) };
}

/** Every fun stat for the leaderboard's day. `today` is the Berlin game day. */
export async function funStats(db: Db, today = berlinToday()): Promise<FunStats> {
  const date = leaderboardDate(await latestSnapshotDate(db), today);
  const started = date >= GAME_START_DATE;
  if (!started) {
    return {
      date,
      started,
      days: 0,
      topGainer: null,
      topLoser: null,
      hotPick: null,
      coldPick: null,
      bestDay: null,
      worstDay: null,
      bestPick: null,
      worstPick: null,
      mostFees: null,
    };
  }

  const game = await loadGame(db, date);
  const rows = standingsFrom(game, date);
  const days = daysBetween(GAME_START_DATE, date) + 1;
  const series = game.players.map((player) => ({
    player,
    points: valueSeries(game.ledgers.get(player.id) ?? [], GAME_START_DATE, date, game.book),
  }));
  return {
    date,
    started,
    days,
    ...playerMovers(rows),
    ...pickMovers(rows, game.book, date),
    ...(days >= 2 ? dayRecords(series) : { bestDay: null, worstDay: null }),
    ...pickRecords(rows),
    mostFees: feeLeader(rows),
  };
}

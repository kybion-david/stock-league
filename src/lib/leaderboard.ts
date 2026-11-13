// Leaderboard (ticket 014): the home page ranking. Picks the day to show,
// gives tied players the same place, hands out medals and says when a
// player's value uses old prices. The numbers come from valuation (ADR 014).
import { benchmarkStanding, type BenchmarkStanding } from "@/lib/benchmark";
import type { Db } from "@/lib/db/db";
import { berlinToday } from "@/lib/transactions";
import {
  GAME_START_DATE,
  latestSnapshotDate,
  loadGame,
  standingsFrom,
  type HoldingValuation,
  type PlayerStanding,
} from "@/lib/valuation";

/** Top three get medals; last place (from 4th down) gets the wooden spoon. */
export type Award = "gold" | "silver" | "bronze" | "spoon";

export interface LeaderboardRow extends PlayerStanding {
  /** 1 for the leader. Equal values share a place (1, 1, 3). */
  place: number;
  award: Award | null;
}

export interface Leaderboard {
  /** The day the values are for (see `leaderboardDate`). */
  date: string;
  /** The latest day with prices, or null before the first daily run. */
  lastUpdated: string | null;
  /** True once `date` is on or after the first game day. */
  started: boolean;
  rows: LeaderboardRow[];
  /** The 70/30 market benchmark on `date` (ADR 025); null before kick-off or its first prices. */
  benchmark: BenchmarkStanding | null;
}

/**
 * The latest day with prices. Before the first daily run, today's game day,
 * so the line-up still shows. Not simply "today": until tonight's run every
 * holding would use yesterday's price and show no day change. Once the game
 * has started, prices from before kick-off (someone bought early) don't keep
 * the board on a pre-game day: it shows today instead.
 */
export function leaderboardDate(lastUpdated: string | null, today: string): string {
  if (lastUpdated === null) return today;
  if (lastUpdated < GAME_START_DATE && today >= GAME_START_DATE) return today;
  return lastUpdated;
}

/** Places and awards for standings already sorted by value, highest first. */
export function rankStandings(rows: readonly PlayerStanding[], started: boolean): LeaderboardRow[] {
  const allEqual = rows.every((r) => r.valueCents === rows[0].valueCents);
  const lastValue = rows.at(-1)?.valueCents;
  let place = 0;
  return rows.map((row, index) => {
    if (index === 0 || row.valueCents !== rows[index - 1].valueCents) place = index + 1;
    const last = row.valueCents === lastValue;
    return { ...row, place, award: started && !allEqual ? award(place, last) : null };
  });
}

function award(place: number, last: boolean): Award | null {
  if (place === 1) return "gold";
  if (place === 2) return "silver";
  if (place === 3) return "bronze";
  return last ? "spoon" : null;
}

/** Everything the home page shows. `today` is the Berlin game day. */
export async function leaderboard(db: Db, today = berlinToday()): Promise<Leaderboard> {
  const lastUpdated = await latestSnapshotDate(db);
  const date = leaderboardDate(lastUpdated, today);
  const started = date >= GAME_START_DATE;
  const game = await loadGame(db, date);
  return {
    date,
    lastUpdated,
    started,
    rows: rankStandings(standingsFrom(game, date), started),
    benchmark: started ? benchmarkStanding(game, date) : null,
  };
}

/**
 * Why a player's value isn't fully up to date, or null if it is: a holding
 * with no price yet (valued at cost), or the oldest price or FX day used.
 */
export function priceNote(holdings: readonly HoldingValuation[]): string | null {
  if (holdings.some((h) => h.priceStatus === "missing")) {
    return "A new buy has no price yet, so it counts at cost.";
  }
  const days = holdings
    .filter((h) => h.priceStatus === "stale")
    .flatMap((h) => [h.priceDate, h.fxDate])
    .filter((d): d is string => d !== null);
  if (days.length === 0) return null;
  return `Uses prices from ${formatDay(days.reduce((a, b) => (a < b ? a : b)))}.`;
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** A `YYYY-MM-DD` day for people, e.g. "Tue 3 Nov". */
export function formatDay(date: string): string {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

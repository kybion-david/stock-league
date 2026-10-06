// Player detail page (ticket 016): one player's place, holdings with their
// gain or loss, cash, fees, dividends, value over the game and history. The
// numbers come from the leaderboard and valuation (ADR 014), so the page
// always agrees with the home page and the chart.
import type { Db } from "@/lib/db/db";
import { listInstruments } from "@/lib/instruments";
import { formatDay, leaderboard, type LeaderboardRow } from "@/lib/leaderboard";
import { berlinToday, listTransactions, type Transaction } from "@/lib/transactions";
import {
  GAME_START_DATE,
  playerSeries,
  type ClosedPosition,
  type HoldingValuation,
  type SeriesPoint,
} from "@/lib/valuation";

export interface HoldingRow extends HoldingValuation {
  /** The instrument's name, e.g. "Apple Inc."; null if unknown. */
  name: string | null;
  /** Share of the player's whole value (cash included), e.g. 0.4; null if that is 0 or less. */
  weight: number | null;
  /** Why the price isn't from the day itself, or null if it is. */
  note: string | null;
}

export interface ClosedRow extends ClosedPosition {
  name: string | null;
}

export interface Portfolio {
  /** The player's leaderboard row: place, award, value, return, day change. */
  row: LeaderboardRow;
  playerCount: number;
  /** The day the values are for, as on the leaderboard. */
  date: string;
  lastUpdated: string | null;
  started: boolean;
  /** Biggest first. */
  holdings: HoldingRow[];
  closed: ClosedRow[];
  /** Gain or loss already booked by selling, over all instruments. */
  realizedCents: number;
  /** Daily values from 2026-11-01 to the latest day with prices; empty before then. */
  series: SeriesPoint[];
  /** Newest first. */
  transactions: Transaction[];
}

/** Everything the player page shows, or null if there's no such player. */
export async function portfolio(
  db: Db,
  playerId: number,
  today = berlinToday(),
): Promise<Portfolio | null> {
  const board = await leaderboard(db, today);
  const row = board.rows.find((r) => r.player.id === playerId);
  if (!row) return null;

  const { lastUpdated } = board;
  const charted = lastUpdated !== null && lastUpdated >= GAME_START_DATE;
  const [instruments, transactions, series] = await Promise.all([
    listInstruments(db),
    listTransactions(db, playerId),
    charted ? playerSeries(db, GAME_START_DATE, lastUpdated) : Promise.resolve([]),
  ]);
  const names = new Map(instruments.map((i) => [i.symbol, i.name]));

  return {
    row,
    playerCount: board.rows.length,
    date: board.date,
    lastUpdated,
    started: board.started,
    holdings: holdingRows(row.holdings, row.valueCents, names),
    closed: row.closedPositions.map((c) => ({ ...c, name: names.get(c.instrument) ?? null })),
    realizedCents: realizedTotal(row.holdings, row.closedPositions),
    series: series.find((s) => s.player.id === playerId)?.points ?? [],
    transactions,
  };
}

/** Holdings with names, weights and price notes, biggest value first (ties by symbol). */
export function holdingRows(
  holdings: readonly HoldingValuation[],
  totalCents: number,
  names: ReadonlyMap<string, string>,
): HoldingRow[] {
  return holdings
    .map((h) => ({
      ...h,
      name: names.get(h.instrument) ?? null,
      weight: totalCents > 0 ? h.valueCents / totalCents : null,
      note: holdingNote(h),
    }))
    .sort((a, b) => b.valueCents - a.valueCents || a.instrument.localeCompare(b.instrument));
}

/** Realized gain or loss from sells, on positions still held and fully sold. */
export function realizedTotal(
  holdings: readonly HoldingValuation[],
  closed: readonly ClosedPosition[],
): number {
  return [...holdings, ...closed].reduce((sum, h) => sum + h.realizedCents, 0);
}

/** One holding's price note, like the leaderboard's but for a single line. */
export function holdingNote(h: HoldingValuation): string | null {
  if (h.manual) {
    return h.priceDate
      ? `Value typed in by hand, last on ${formatDay(h.priceDate)}.`
      : "No value typed in yet, so it counts at cost.";
  }
  if (h.priceStatus === "missing") return "No price yet, so it counts at cost.";
  if (h.priceStatus === "current") return null;
  const days = [h.priceDate, h.fxDate].filter((d): d is string => d !== null);
  if (days.length === 0) return null;
  return `Price from ${formatDay(days.reduce((a, b) => (a < b ? a : b)))}.`;
}

const ordinalRules = new Intl.PluralRules("en-GB", { type: "ordinal" });
const SUFFIXES: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "st", two: "nd", few: "rd" };

/** A leaderboard place for people, e.g. "2nd of 5". */
export function formatPlace(place: number, count: number): string {
  return `${place}${SUFFIXES[ordinalRules.select(place)] ?? "th"} of ${count}`;
}

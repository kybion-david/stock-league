// Market benchmark (ADR 025): what €1,000 would have done in a plain
// 70% developed / 30% emerging markets ETF mix bought at kick-off and left
// alone. It shows on the leaderboard, the chart and the player page so
// everyone can see whether they're beating the market. It's valued like a
// player with two buys on the first game day, so it uses the same prices,
// carry-forward and ⏳ rules as everyone else (ADR 014).
import type { Db } from "@/lib/db/db";
import { addDays } from "@/lib/ingest";
import {
  formatShares,
  parseShares,
  SHARE_DECIMALS,
  STARTING_CASH_CENTS,
  type LedgerTransaction,
} from "@/lib/ledger";
import {
  dayChange,
  GAME_START_DATE,
  valuePlayer,
  valueSeries,
  type DayChange,
  type GameData,
  type PlayerValuation,
  type PriceBook,
  type SeriesPoint,
} from "@/lib/valuation";

export interface BenchmarkPart {
  /** Yahoo symbol (a EUR listing, so no FX is needed). */
  symbol: string;
  name: string;
  /** Short label for people, e.g. "Developed". */
  label: string;
  /** How much of the €1,000 goes into it at kick-off, in cents. */
  cents: number;
}

/**
 * MSCI World for developed markets and MSCI EM IMI for emerging markets,
 * both iShares Core ETFs on Xetra in EUR. The parts add up to the stake.
 */
export const BENCHMARK = {
  name: "Market",
  emoji: "🌍",
  description: "70% developed, 30% emerging markets",
  parts: [
    {
      symbol: "EUNL.DE",
      name: "iShares Core MSCI World UCITS ETF USD (Acc)",
      label: "Developed",
      cents: 70_000,
    },
    {
      symbol: "IS3N.DE",
      name: "iShares Core MSCI EM IMI UCITS ETF USD (Acc)",
      label: "Emerging",
      cents: 30_000,
    },
  ] satisfies BenchmarkPart[],
} as const;

/** The symbols the daily job fetches every day from kick-off, held or not. */
export const BENCHMARK_SYMBOLS: readonly string[] = BENCHMARK.parts.map((p) => p.symbol);

/**
 * Adds the benchmark's instruments if they aren't there yet, so the daily
 * job can store prices for them. Leaves an existing row (say a player
 * added the same ETF) as it is.
 */
export async function ensureBenchmarkInstruments(db: Db): Promise<void> {
  for (const part of BENCHMARK.parts) {
    await db.query(
      `insert into instruments (symbol, name, type, currency, exchange)
       values ($1, $2, 'etf', 'EUR', 'GER')
       on conflict (symbol) do nothing`,
      [part.symbol, part.name],
    );
  }
}

/**
 * The benchmark as a ledger: one buy per part on the first game day, at
 * that day's close (the last one before it if markets were shut). Shares
 * are rounded down to 8 decimals. Null until every part has a price on or
 * before kick-off.
 */
export function benchmarkLedger(
  book: PriceBook,
  parts: readonly BenchmarkPart[] = BENCHMARK.parts,
): LedgerTransaction[] | null {
  const ledger: LedgerTransaction[] = [];
  for (const part of parts) {
    const price = book.close(part.symbol, GAME_START_DATE);
    if (!price) return null;
    const rate = price.currency === "EUR" ? null : book.fx(price.currency, GAME_START_DATE);
    if (price.currency !== "EUR" && !rate) return null;
    const eurPerShare = Number(price.close) / Number(rate?.unitsPerEur ?? "1");
    if (!(eurPerShare > 0)) return null;
    const shares = Math.floor((part.cents / 100 / eurPerShare) * 10 ** SHARE_DECIMALS);
    ledger.push({
      id: `benchmark-${part.symbol}`,
      date: GAME_START_DATE,
      type: "buy",
      instrumentId: part.symbol,
      shares: formatShares(parseShares((shares / 10 ** SHARE_DECIMALS).toFixed(SHARE_DECIMALS))),
      amountCents: part.cents,
    });
  }
  return ledger;
}

export type BenchmarkStanding = PlayerValuation & DayChange;

/** The benchmark's value on `date` with its day change; null before it has prices. */
export function benchmarkStanding(game: GameData, date: string): BenchmarkStanding | null {
  if (date < GAME_START_DATE) return null;
  const ledger = benchmarkLedger(game.book);
  if (!ledger) return null;
  const today = valuePlayer(ledger, date, game.book);
  const yesterday = valuePlayer(ledger, addDays(date, -1), game.book);
  return { ...today, ...dayChange(today.valueCents, yesterday.valueCents) };
}

/** The benchmark's daily values from `from` to `to`; null before it has prices. */
export function benchmarkSeries(game: GameData, from: string, to: string): SeriesPoint[] | null {
  const ledger = benchmarkLedger(game.book);
  return ledger ? valueSeries(ledger, from, to, game.book) : null;
}

/**
 * How far a value is ahead of (positive) or behind the market, in cents.
 * Everyone started with the same stake, so this is also the gap in return:
 * `cents / €1,000`.
 */
export function versusMarket(valueCents: number, market: { valueCents: number }) {
  const cents = valueCents - market.valueCents;
  return { cents, rate: cents / STARTING_CASH_CENTS };
}

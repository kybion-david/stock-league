// Valuation (ticket 012, ADR 014): each player's value in EUR on any day,
// from the ledger replay and the stored price and FX snapshots. Return,
// day change and per-holding gain (average cost) are computed here too.
// The dashboard tickets (014–017) build on this.
import type { Db } from "@/lib/db/db";
import { addDays } from "@/lib/ingest";
import {
  parseShares,
  replay,
  STARTING_CASH_CENTS,
  type LedgerTransaction,
} from "@/lib/ledger";
import type { Player } from "@/lib/players";

/** First game day (SPEC → Game rules). */
export const GAME_START_DATE = "2026-11-01";

export interface PriceRow {
  /** Instrument key, the same one the ledger uses (the DB layer uses the symbol). */
  instrument: string;
  date: string;
  /** Exact decimal string, in `currency` major units. */
  close: string;
  currency: string;
}

export interface FxRow {
  date: string;
  currency: string;
  /** 1 EUR = `unitsPerEur` units of `currency`. */
  unitsPerEur: string;
}

/** Looks up the last known close and FX rate on or before a day. */
export interface PriceBook {
  close(instrument: string, date: string): PriceRow | null;
  fx(currency: string, date: string): FxRow | null;
  /** True for a manual instrument (ADR 022), whose value players type in. */
  isManual?(instrument: string): boolean;
}

/**
 * `current`: price (and FX) are from the day itself.
 * `stale`: the last known price or FX rate from an earlier day was used.
 * `missing`: no price (or no FX rate) at all on or before the day, so the
 * holding is valued at what it cost.
 */
export type PriceStatus = "current" | "stale" | "missing";

export interface HoldingValuation {
  instrument: string;
  /** Normalized decimal string, > 0. */
  shares: string;
  /** What the shares still held cost, in cents (average cost). */
  costCents: number;
  valueCents: number;
  /** `valueCents − costCents`: the gain or loss not yet realized. */
  gainCents: number;
  /** `gainCents / costCents`, e.g. 0.05 for +5%. */
  gainRate: number;
  /** Gain or loss from shares of this instrument already sold. */
  realizedCents: number;
  priceStatus: PriceStatus;
  /** Day of the close used; null when `missing`. */
  priceDate: string | null;
  /** Day of the FX rate used; null for EUR or when `missing`. */
  fxDate: string | null;
  /**
   * Set for a manual instrument (ADR 022). Its last entered value counts as
   * `current` however old it is, and before the first one it counts at cost.
   */
  manual?: true;
}

/** An instrument the player has fully sold, with what it made or lost. */
export interface ClosedPosition {
  instrument: string;
  realizedCents: number;
}

export interface PlayerValuation {
  date: string;
  cashCents: number;
  holdingsValueCents: number;
  /** Cash plus holdings: the score. */
  valueCents: number;
  /** `valueCents − €1,000`. */
  returnCents: number;
  /** `returnCents / €1,000`, e.g. 0.05 for +5%. */
  returnRate: number;
  /** Fees and dividends entered up to and including the day. */
  feesCents: number;
  dividendsCents: number;
  /** Shares > 0, sorted by instrument key. */
  holdings: HoldingValuation[];
  closedPositions: ClosedPosition[];
  /** True if any holding's price is `stale` or `missing`. */
  stale: boolean;
}

export interface DayChange {
  /** Value change since the end of the day before. */
  dayChangeCents: number;
  /** `dayChangeCents / previous value`; null if the previous value was 0 or less. */
  dayChangeRate: number | null;
}

export interface SeriesPoint extends DayChange {
  date: string;
  valueCents: number;
  returnRate: number;
  stale: boolean;
}

/** Builds a `PriceBook` from snapshot rows (any order) and the manual instruments' keys. */
export function createPriceBook(
  prices: readonly PriceRow[],
  fx: readonly FxRow[],
  manual: Iterable<string> = [],
): PriceBook {
  const closes = groupByDate(prices, (p) => p.instrument);
  const rates = groupByDate(fx, (r) => r.currency);
  const manualSet = new Set(manual);
  return {
    close: (instrument, date) => lastOnOrBefore(closes.get(instrument), date),
    fx: (currency, date) => lastOnOrBefore(rates.get(currency), date),
    isManual: (instrument) => manualSet.has(instrument),
  };
}

function groupByDate<T extends { date: string }>(
  rows: readonly T[],
  key: (row: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(key(row)) ?? [];
    list.push(row);
    groups.set(key(row), list);
  }
  for (const list of groups.values()) list.sort((a, b) => compare(a.date, b.date));
  return groups;
}

/** Binary search in rows sorted by date. */
function lastOnOrBefore<T extends { date: string }>(rows: T[] | undefined, date: string): T | null {
  if (!rows) return null;
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].date <= date) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? rows[lo - 1] : null;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A non-negative decimal string as an integer and its power-of-ten scale. */
function decimal(text: string): { units: bigint; scale: bigint } {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) throw new TypeError(`Expected a decimal, got "${text}"`);
  const fraction = match[2] ?? "";
  return {
    units: BigInt(match[1] + fraction),
    scale: BigInt(10) ** BigInt(fraction.length),
  };
}

/** `numerator / denominator` rounded half up, for non-negative values. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  const two = BigInt(2);
  return (numerator * two + denominator) / (denominator * two);
}

/**
 * EUR value in cents of `shares` at `close` (in a currency where
 * 1 EUR = `unitsPerEur`), computed exactly and rounded half up to a cent.
 */
export function eurCents(shares: string, close: string, unitsPerEur = "1"): number {
  const s = decimal(shares);
  const c = decimal(close);
  const f = decimal(unitsPerEur);
  if (f.units === BigInt(0)) throw new RangeError("FX rate must be more than 0");
  const numerator = s.units * c.units * BigInt(100) * f.scale;
  const denominator = s.scale * c.scale * f.units;
  return Number(divRound(numerator, denominator));
}

interface CostState {
  units: bigint;
  costCents: number;
  realizedCents: number;
}

/**
 * Average cost per instrument up to and including `date`. Within a day,
 * buys are applied before sells (the ledger only checks the end of the day,
 * ADR 007), so a sell never meets an empty position mid-day.
 */
function costBasis(
  transactions: readonly LedgerTransaction[],
  date: string,
): { costs: Map<string, CostState>; feesCents: number; dividendsCents: number } {
  const rank = (tx: LedgerTransaction) => (tx.type === "sell" ? 1 : 0);
  const sorted = transactions
    .map((tx, index) => ({ tx, index }))
    .filter(({ tx }) => tx.date <= date)
    .sort(
      (a, b) =>
        compare(a.tx.date, b.tx.date) || rank(a.tx) - rank(b.tx) || a.index - b.index,
    )
    .map(({ tx }) => tx);

  const costs = new Map<string, CostState>();
  let feesCents = 0;
  let dividendsCents = 0;
  for (const tx of sorted) {
    if (tx.type === "fee") {
      feesCents += tx.amountCents;
      continue;
    }
    if (tx.type === "dividend") {
      dividendsCents += tx.amountCents;
      continue;
    }
    const key = tx.instrumentId ?? "";
    const state = costs.get(key) ?? { units: BigInt(0), costCents: 0, realizedCents: 0 };
    const units = parseShares(tx.shares ?? "0");
    if (tx.type === "buy") {
      state.units += units;
      state.costCents += tx.amountCents;
    } else {
      // Selling everything held (or, in a broken ledger, more) removes all the cost.
      const removed =
        units >= state.units
          ? state.costCents
          : Number(divRound(BigInt(state.costCents) * units, state.units));
      state.units -= units;
      state.costCents -= removed;
      state.realizedCents += tx.amountCents - removed;
    }
    costs.set(key, state);
  }
  return { costs, feesCents, dividendsCents };
}

function valueHolding(
  instrument: string,
  shares: string,
  cost: CostState | undefined,
  date: string,
  book: PriceBook,
): HoldingValuation {
  const costCents = cost?.costCents ?? 0;
  const manual = book.isManual?.(instrument) ?? false;
  const base = {
    instrument,
    shares,
    costCents,
    realizedCents: cost?.realizedCents ?? 0,
    ...(manual && { manual: true as const }),
  };
  const price = book.close(instrument, date);
  const rate = price && price.currency !== "EUR" ? book.fx(price.currency, date) : null;

  if (!price || (price.currency !== "EUR" && !rate)) {
    return {
      ...base,
      valueCents: costCents,
      gainCents: 0,
      gainRate: 0,
      priceStatus: manual ? "current" : "missing",
      priceDate: null,
      fxDate: null,
    };
  }
  const valueCents = eurCents(shares, price.close, rate?.unitsPerEur);
  const gainCents = valueCents - costCents;
  const current = manual || (price.date === date && (!rate || rate.date === date));
  return {
    ...base,
    valueCents,
    gainCents,
    gainRate: costCents > 0 ? gainCents / costCents : 0,
    priceStatus: current ? "current" : "stale",
    priceDate: price.date,
    fxDate: rate?.date ?? null,
  };
}

/**
 * One player's value at the end of `date` (`YYYY-MM-DD`), from their
 * ledger and the prices known on or before that day.
 */
export function valuePlayer(
  transactions: readonly LedgerTransaction[],
  date: string,
  book: PriceBook,
): PlayerValuation {
  const state = replay(transactions, date);
  const { costs, feesCents, dividendsCents } = costBasis(transactions, date);

  const holdings = Object.entries(state.holdings)
    .filter(([, shares]) => !shares.startsWith("-"))
    .sort(([a], [b]) => compare(a, b))
    .map(([instrument, shares]) =>
      valueHolding(instrument, shares, costs.get(instrument), date, book),
    );
  const closedPositions = [...costs.entries()]
    .filter(([instrument]) => !(instrument in state.holdings))
    .sort(([a], [b]) => compare(a, b))
    .map(([instrument, cost]) => ({ instrument, realizedCents: cost.realizedCents }));

  const holdingsValueCents = holdings.reduce((sum, h) => sum + h.valueCents, 0);
  const valueCents = state.cashCents + holdingsValueCents;
  const returnCents = valueCents - STARTING_CASH_CENTS;
  return {
    date,
    cashCents: state.cashCents,
    holdingsValueCents,
    valueCents,
    returnCents,
    returnRate: returnCents / STARTING_CASH_CENTS,
    feesCents,
    dividendsCents,
    holdings,
    closedPositions,
    stale: holdings.some((h) => h.priceStatus !== "current"),
  };
}

/** Change from the previous day's value to today's. */
export function dayChange(valueCents: number, previousValueCents: number): DayChange {
  const dayChangeCents = valueCents - previousValueCents;
  return {
    dayChangeCents,
    dayChangeRate: previousValueCents > 0 ? dayChangeCents / previousValueCents : null,
  };
}

/**
 * One point per calendar day from `from` to `to` inclusive. The first
 * point's day change is against the day before `from` (€1,000 before the
 * first trade).
 */
export function valueSeries(
  transactions: readonly LedgerTransaction[],
  from: string,
  to: string,
  book: PriceBook,
): SeriesPoint[] {
  if (from > to) throw new RangeError(`Start date ${from} is after end date ${to}`);
  const points: SeriesPoint[] = [];
  let previous = valuePlayer(transactions, addDays(from, -1), book).valueCents;
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const v = valuePlayer(transactions, date, book);
    points.push({
      date,
      valueCents: v.valueCents,
      returnRate: v.returnRate,
      stale: v.stale,
      ...dayChange(v.valueCents, previous),
    });
    previous = v.valueCents;
  }
  return points;
}

// --- Database layer: load everything once, then value in memory. ---

export interface PlayerStanding extends PlayerValuation, DayChange {
  player: Player;
}

export interface PlayerSeries {
  player: Player;
  points: SeriesPoint[];
}

/** Everything valuation needs, loaded once (see `loadGame`). */
export interface GameData {
  players: Player[];
  ledgers: Map<number, LedgerTransaction[]>;
  book: PriceBook;
}

/**
 * Loads every player, ledger and snapshot up to `to`. Instruments are keyed
 * by symbol (unique and fixed, ADR 011), so holdings read "AAPL".
 */
export async function loadGame(db: Db, to: string): Promise<GameData> {
  const players = await db.query<Player>("select id, name, emoji from players order by name");
  const rows = await db.query<{
    id: number;
    playerId: number;
    date: string;
    type: LedgerTransaction["type"];
    symbol: string | null;
    shares: string | null;
    amountCents: number;
  }>(
    `select t.id, t.player_id as "playerId", t.date, t.type, i.symbol, t.shares,
       t.amount_cents as "amountCents"
     from transactions t left join instruments i on i.id = t.instrument_id
     where t.date <= $1 order by t.date, t.id`,
    [to],
  );
  const ledgers = new Map<number, LedgerTransaction[]>(players.map((p) => [p.id, []]));
  for (const r of rows) {
    ledgers.get(r.playerId)?.push({
      id: String(r.id),
      date: r.date,
      type: r.type,
      instrumentId: r.symbol,
      shares: r.shares,
      amountCents: r.amountCents,
    });
  }
  const prices = await db.query<PriceRow>(
    `select i.symbol as instrument, p.date, p.close, p.currency
     from price_snapshots p join instruments i on i.id = p.instrument_id
     where p.date <= $1`,
    [to],
  );
  const fx = await db.query<FxRow>(
    `select date, currency, units_per_eur as "unitsPerEur" from fx_snapshots where date <= $1`,
    [to],
  );
  const manual = await db.query<{ symbol: string }>(
    "select symbol from instruments where type = 'manual'",
  );
  return { players, ledgers, book: createPriceBook(prices, fx, manual.map((m) => m.symbol)) };
}

/**
 * Every player's value at the end of `date`, with the change since the day
 * before, highest value first (ties by name).
 */
export async function standings(db: Db, date: string): Promise<PlayerStanding[]> {
  return standingsFrom(await loadGame(db, date), date);
}

/** `standings` on data already loaded up to at least `date`. */
export function standingsFrom({ players, ledgers, book }: GameData, date: string): PlayerStanding[] {
  return players
    .map((player) => {
      const ledger = ledgers.get(player.id) ?? [];
      const today = valuePlayer(ledger, date, book);
      const yesterday = valuePlayer(ledger, addDays(date, -1), book);
      return { player, ...today, ...dayChange(today.valueCents, yesterday.valueCents) };
    })
    .sort((a, b) => b.valueCents - a.valueCents || a.player.name.localeCompare(b.player.name));
}

/** Every player's daily values from `from` to `to` inclusive, by name. */
export async function playerSeries(db: Db, from: string, to: string): Promise<PlayerSeries[]> {
  return seriesFrom(await loadGame(db, to), from, to);
}

/** `playerSeries` on data already loaded up to at least `to`. */
export function seriesFrom({ players, ledgers, book }: GameData, from: string, to: string): PlayerSeries[] {
  return players.map((player) => ({
    player,
    points: valueSeries(ledgers.get(player.id) ?? [], from, to, book),
  }));
}

/**
 * The latest day with any fetched price snapshot, for "last updated"; null
 * if none. Manual values (ADR 022) don't count: one typed in for today
 * mustn't move the leaderboard past the last daily run.
 */
export async function latestSnapshotDate(db: Db): Promise<string | null> {
  const [row] = await db.query<{ date: string | null }>(
    `select max(p.date) as date from price_snapshots p
     join instruments i on i.id = p.instrument_id where i.type <> 'manual'`,
  );
  return row?.date ?? null;
}

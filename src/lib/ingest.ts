// Snapshot ingestion (ticket 011, ADR 012): stores one day's closes for every
// held instrument, plus the FX rates they need, in price_snapshots and
// fx_snapshots. Idempotent per day; one failure never stops the run.
import type { Db } from "@/lib/db/db";
import { replay, type LedgerTransaction } from "@/lib/ledger";
import { isNoDataError, type MarketDataClient } from "@/lib/market-data";

/** How far back carry-forward looks for a close (stored, then from the provider). */
export const CARRY_FORWARD_DAYS = 10;

export type PriceResult =
  | { symbol: string; status: "fetched"; close: string; currency: string }
  /** No close on the day (weekend, holiday): the last close is stored for the day. `from` is the day it was copied from (which may itself be a carried day). */
  | { symbol: string; status: "carried"; close: string; currency: string; from: string }
  | { symbol: string; status: "failed"; error: string };

export type FxResult =
  /** `from` is the date the ECB published the rate, earlier than the day on weekends and holidays. */
  | { currency: string; status: "fetched"; unitsPerEur: string; from: string }
  | { currency: string; status: "failed"; error: string };

export interface IngestReport {
  date: string;
  prices: PriceResult[];
  fx: FxResult[];
}

/** True if anything in the reports failed. Carried prices don't count as failures. */
export function hasFailures(reports: readonly IngestReport[]): boolean {
  return reports.some(
    (r) => r.prices.some((p) => p.status === "failed") || r.fx.some((f) => f.status === "failed"),
  );
}

/**
 * Fetches and stores the snapshots for one day. `date` is the trading date
 * the client should ask for (for the daily job: the UTC date at 22:30 UTC).
 * Existing rows for the day are updated, never duplicated. A failed symbol
 * or currency is reported and leaves its stored row (if any) untouched.
 */
export async function ingestDate(
  db: Db,
  client: MarketDataClient,
  date: string,
): Promise<IngestReport> {
  return ingestDay(db, client, date, false);
}

/** How many days before the run's date `fillGaps` looks back. */
export const GAP_FILL_DAYS = 7;

/**
 * Fills in the price and FX rows missing on the `days` days before `date`,
 * oldest first, without touching rows already stored. A buy entered after
 * its day's run (players often enter trades the next morning, or backdate
 * them) otherwise never gets prices for the days before the next run, so it
 * counts at cost there and its first price lands as one big day change.
 * Returns a report only for days where something was missing.
 */
export async function fillGaps(
  db: Db,
  client: MarketDataClient,
  date: string,
  days = GAP_FILL_DAYS,
): Promise<IngestReport[]> {
  assertDate(date);
  const reports: IngestReport[] = [];
  for (let day = addDays(date, -days); day < date; day = addDays(day, 1)) {
    const report = await ingestDay(db, client, day, true);
    if (report.prices.length > 0 || report.fx.length > 0) reports.push(report);
  }
  return reports;
}

/** `ingestDate`, or with `onlyMissing` just the rows the day doesn't have yet. */
async function ingestDay(
  db: Db,
  client: MarketDataClient,
  date: string,
  onlyMissing: boolean,
): Promise<IngestReport> {
  assertDate(date);
  const prices: PriceResult[] = [];
  const currencies = new Set<string>();
  const stored = onlyMissing ? await storedRows(db, date) : null;

  for (const instrument of await heldInstruments(db, date)) {
    const storedCurrency = stored?.prices.get(instrument.id);
    if (storedCurrency !== undefined) {
      if (storedCurrency !== "EUR") currencies.add(storedCurrency);
      continue;
    }
    const result = await ingestPrice(db, client, instrument, date);
    prices.push(result);
    if (result.status !== "failed" && result.currency !== "EUR") currencies.add(result.currency);
  }

  const fx: FxResult[] = [];
  for (const currency of [...currencies].sort()) {
    if (stored?.fx.has(currency)) continue;
    try {
      const rate = await client.getFxToEur(currency, date);
      // Stored under the day, not the ECB's publication date, so valuation
      // finds a rate for every day it has prices for.
      await db.query(
        `insert into fx_snapshots (date, currency, units_per_eur) values ($1, $2, $3)
         on conflict (date, currency)
         do update set units_per_eur = excluded.units_per_eur, fetched_at = now()`,
        [date, currency, rate.unitsPerEur],
      );
      fx.push({ currency, status: "fetched", unitsPerEur: rate.unitsPerEur, from: rate.date });
    } catch (err) {
      fx.push({ currency, status: "failed", error: message(err) });
    }
  }

  return { date, prices, fx };
}

/** Runs `ingestDate` for every day from `from` to `to` inclusive, oldest first. */
export async function ingestRange(
  db: Db,
  client: MarketDataClient,
  from: string,
  to: string,
): Promise<IngestReport[]> {
  assertDate(from);
  assertDate(to);
  if (from > to) throw new RangeError(`Start date ${from} is after end date ${to}`);
  const reports: IngestReport[] = [];
  // Oldest first, so each day can carry forward from the one before.
  for (let day = from; day <= to; day = addDays(day, 1)) {
    reports.push(await ingestDate(db, client, day));
  }
  return reports;
}

/** The price rows (instrument id → currency) and FX currencies stored for a day. */
async function storedRows(
  db: Db,
  date: string,
): Promise<{ prices: Map<number, string>; fx: Set<string> }> {
  const prices = await db.query<{ instrument_id: number; currency: string }>(
    "select instrument_id, currency from price_snapshots where date = $1",
    [date],
  );
  const fx = await db.query<{ currency: string }>(
    "select currency from fx_snapshots where date = $1",
    [date],
  );
  return {
    prices: new Map(prices.map((p) => [p.instrument_id, p.currency])),
    fx: new Set(fx.map((r) => r.currency)),
  };
}

interface Instrument {
  id: number;
  symbol: string;
}

/** Instruments any player holds shares of at the end of `date`. */
async function heldInstruments(db: Db, date: string): Promise<Instrument[]> {
  const rows = await db.query<{
    id: number;
    player_id: number;
    date: string;
    type: LedgerTransaction["type"];
    instrument_id: number | null;
    shares: string | null;
    amount_cents: number;
  }>(
    `select id, player_id, date, type, instrument_id, shares, amount_cents
     from transactions where date <= $1 order by id`,
    [date],
  );
  const byPlayer = new Map<number, LedgerTransaction[]>();
  for (const r of rows) {
    const list = byPlayer.get(r.player_id) ?? [];
    list.push({
      id: String(r.id),
      date: r.date,
      type: r.type,
      instrumentId: r.instrument_id === null ? null : String(r.instrument_id),
      shares: r.shares,
      amountCents: r.amount_cents,
    });
    byPlayer.set(r.player_id, list);
  }
  const held = new Set<number>();
  for (const ledger of byPlayer.values()) {
    for (const [id, shares] of Object.entries(replay(ledger, date).holdings)) {
      if (!shares.startsWith("-")) held.add(Number(id));
    }
  }
  if (held.size === 0) return [];
  const all = await db.query<Instrument>("select id, symbol from instruments order by symbol");
  return all.filter((i) => held.has(i.id));
}

async function ingestPrice(
  db: Db,
  client: MarketDataClient,
  instrument: Instrument,
  date: string,
): Promise<PriceResult> {
  const { symbol } = instrument;
  try {
    try {
      const close = await client.getClose(symbol, date);
      await upsertPrice(db, instrument.id, date, close.close, close.currency);
      return { symbol, status: "fetched", close: close.close, currency: close.currency };
    } catch (err) {
      if (!isNoDataError(err)) throw err;
    }
    const last = await lastClose(db, client, instrument, date);
    if (!last) {
      return {
        symbol,
        status: "failed",
        error: `No close on ${date} or in the ${CARRY_FORWARD_DAYS} days before`,
      };
    }
    await upsertPrice(db, instrument.id, date, last.close, last.currency);
    return { symbol, status: "carried", ...last };
  } catch (err) {
    return { symbol, status: "failed", error: message(err) };
  }
}

/**
 * The last close before `date`: from the database first, else walking back
 * day by day with the client (e.g. the first game day is a Sunday and
 * nothing is stored yet).
 */
async function lastClose(
  db: Db,
  client: MarketDataClient,
  instrument: Instrument,
  date: string,
): Promise<{ close: string; currency: string; from: string } | null> {
  // Strictly before the day, so re-running a carried day picks up a
  // corrected close from the day before.
  const [stored] = await db.query<{ close: string; currency: string; date: string }>(
    `select close, currency, date from price_snapshots
     where instrument_id = $1 and date < $2 and date >= $3
     order by date desc limit 1`,
    [instrument.id, date, addDays(date, -CARRY_FORWARD_DAYS)],
  );
  if (stored) return { close: stored.close, currency: stored.currency, from: stored.date };

  for (let back = 1; back <= CARRY_FORWARD_DAYS; back++) {
    const day = addDays(date, -back);
    try {
      const close = await client.getClose(instrument.symbol, day);
      return { close: close.close, currency: close.currency, from: day };
    } catch (err) {
      if (!isNoDataError(err)) throw err;
    }
  }
  return null;
}

async function upsertPrice(
  db: Db,
  instrumentId: number,
  date: string,
  close: string,
  currency: string,
): Promise<void> {
  await db.query(
    `insert into price_snapshots (instrument_id, date, close, currency) values ($1, $2, $3, $4)
     on conflict (instrument_id, date)
     do update set close = excluded.close, currency = excluded.currency, fetched_at = now()`,
    [instrumentId, date, close, currency],
  );
}

/** `YYYY-MM-DD` plus `days` (may be negative), in calendar days. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function assertDate(date: string): void {
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    addDays(date, 0) === date;
  if (!valid) throw new TypeError(`Expected a YYYY-MM-DD date, got "${date}"`);
}

function message(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
